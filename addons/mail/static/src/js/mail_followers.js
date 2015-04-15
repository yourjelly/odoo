odoo.define('mail.mail_followers', function (require) {
"use strict";

var mail_utils = require('mail.utils');
var core = require('web.core');
var data = require('web.data');
var Dialog = require('web.Dialog');
var form_common = require('web.form_common');
var session = require('web.session');
var web_client = require('web.web_client');

var _t = core._t;
var QWeb = core.qweb;

/** 
 * ------------------------------------------------------------
 * mail_followers Widget
 * ------------------------------------------------------------
 *
 * This widget handles the display of a list of records as a vertical
 * list, with an image on the left. The widget itself is a floatting
 * right-sided box.
 * This widget is mainly used to display the followers of records
 * in OpenChatter.
 */


var Followers = form_common.AbstractField.extend({
    template: 'mail.followers',

    init: function() {
        this._super.apply(this, arguments);
        this.image = this.node.attrs.image || 'image_small';
        this.comment = this.node.attrs.help || false;
        this.displayed_limit = this.node.attrs.displayed_nb || 10;
        this.displayed_nb = this.displayed_limit;
        this.ds_model = new data.DataSetSearch(this, this.view.model);
        this.ds_users = new data.DataSetSearch(this, 'res.users');

        this.value = [];
        this.followers = [];
        
        this.view_is_editable = this.__parentedParent.is_action_enabled('edit');
    },

    start: function() {
        // use actual_mode property on view to know if the view is in create mode anymore
        this.view.on("change:actual_mode", this, this.on_check_visibility_mode);
        this.on_check_visibility_mode();
        this.reinit();
        this.bind_events();
        this._super();
    },

    on_check_visibility_mode: function () {
        this.set({"force_invisible": this.view.get("actual_mode") == "create"});
    },

    set_value: function(_value) {
        this.value = _value;
        this._super(_value);
    },

    reinit: function() {
        this.message_is_follower = false;
        this.display_buttons();
    },

    bind_events: function() {
        var self = this;
        // event: click on '(Un)Follow' button, that toggles the follow for uid
        this.$('.o_follow_btn').on('click', function () {
            if($(this).hasClass('o_not_following')) {
                self.do_follow();
            } else {
                self.do_unfollow();
            }
        });
        // event: click on a subtype, that (un)subscribe for this subtype
        this.$el.on('click', ".o_subtype_list > li:not('.divider')", function(event) {
            self.on_item_clicked(event);
            self.do_update_subscription(event);
            event.stopPropagation();
        });
        // event: do not close the drodown when clicking on a divider
        this.$el.on('click', ".o_subtype_list", function(event) {
            event.stopPropagation();
        });
        // event: click on 'invite' button, that opens the invite wizard
        this.$('.o_invite').on('click', self.on_invite_follower);
        // event: click on 'edit_subtype(pencil)' button to edit subscription
        this.$el.on('click', '.o_edit_subtype', self.on_edit_subtype);
        this.$el.on('click', '.oe_remove_follower', self.on_remove_follower);
        this.$el.on('click', '.oe_show_more', self.on_show_more_followers);
        this.$el.on('click', 'a[data-partner]', self.on_follower_clicked);
    },

    on_edit_subtype: function(event) {
        var self = this;
        var $currentTarget = $(event.currentTarget);
        var user_pid = $currentTarget.data('id');
        this.dialog = new Dialog(this, {
                        size: 'small',
                        title: _t('Edit Subscription of ') + $currentTarget.siblings('a').text(),
                        buttons: [
                                { text: _t("Apply"), click: function() { 
                                    self.do_update_subscription(event, user_pid);
                                    this.parents('.modal').modal('hide');
                                }},
                                { text: _t("Cancel"), click: function() { this.parents('.modal').modal('hide'); }}
                            ],
                }, "<ul class='o_edit_subtype_popup_list'>").open();
        // event: click on a subtype in the edit subtype popup
        this.dialog.$el.on('click', "li:not('.divider')", function(event) {
            self.on_item_clicked(event);
            event.stopPropagation();
        });

        return self.fetch_subtypes(user_pid);
    },

    on_invite_follower: function () {
        var self = this;
        var action = {
            type: 'ir.actions.act_window',
            res_model: 'mail.wizard.invite',
            view_mode: 'form',
            view_type: 'form',
            views: [[false, 'form']],
            name: _t('Invite Follower'),
            target: 'new',
            context: {
                'default_res_model': this.view.dataset.model,
                'default_res_id': this.view.datarecord.id,
            },
        };
        this.do_action(action, {
            on_close: function() {
                self.read_value();
            },
        });
    },

    on_show_more_followers: function () {
        this.displayed_nb += this.displayed_limit;
        this.display_followers(false);
    },

    on_remove_follower: function (event) {
        var partner_id = $(event.target).data('id');
        var name = $(event.target).parent().find("a").html();
        if (confirm(_.str.sprintf(_t("Warning! \n %s won't be notified of any email or discussion on this document. Do you really want to remove him from the followers ?"), name))) {
            var context = new data.CompoundContext(this.build_context(), {});
            return this.ds_model.call('message_unsubscribe', [[this.view.datarecord.id], [partner_id], context])
                .then(this.proxy('read_value'));
        }
    },

    on_follower_clicked: function  (event) {
        event.preventDefault();
        var partner_id = $(event.target).data('partner');
        var state = {
            'model': 'res.partner',
            'id': partner_id,
            'title': this.record_name
        };
        web_client.action_manager.do_push_state(state);
        var action = {
            type:'ir.actions.act_window',
            view_type: 'form',
            view_mode: 'form',
            res_model: 'res.partner',
            views: [[false, 'form']],
            res_id: partner_id,
        };
        this.do_action(action);
    },

    on_item_clicked: function (event) {
        var $item_clicked = $(event.target).parent('li');
        if($item_clicked) {
            $item_clicked.toggleClass("selected");
        }
    },

    read_value: function () {
        var self = this;
        this.displayed_nb = this.displayed_limit;
        return this.ds_model.read_ids([this.view.datarecord.id], ['message_follower_ids']).then(function (results) {
            self.value = results[0].message_follower_ids;
            self.render_value();
        });
    },

    render_value: function () {
        return this.fetch_followers(this.value);
    },

    fetch_followers: function (value_) {
        this.value = value_ || [];
        return this.ds_model.call('read_followers_data', [this.value])
            .then(this.proxy('display_followers'), this.proxy('fetch_generic'))
            .then(this.proxy('display_buttons'))
            .then(this.proxy('fetch_subtypes'));
    },

    /** Read on res.partner failed: fall back on a generic case
        - fetch current user partner_id (call because no other smart solution currently) FIXME
        - then display a generic message about followers */
    fetch_generic: function (error, event) {
        var self = this;
        event.preventDefault();
        return this.ds_users.call('read', [[session.uid], ['partner_id']]).then(function (results) {
            var pid = results[0]['partner_id'][0];
            self.message_is_follower = (_.indexOf(self.value, pid) != -1);
        }).then(self.proxy('display_generic'));
    },

    _format_followers: function(count){
        var str = '';
        if(count <= 0){
            str = _t('No followers');
        }else if(count === 1){
            str = _t('One follower');
        }else{
            str = ''+count+' '+_t('followers');
        }
        return str;
    },

    /* Display generic info about follower, for people not having access to res_partner */
    display_generic: function () {
        this.$('.oe_follower_list').empty();
        this.$('.o_follower_title').html(this._format_followers(this.value.length));
    },

    /** Display the followers */
    display_followers: function (records) {
        var self = this;
        this.message_is_follower = false;
        this.followers = records || this.followers;
        // clean and display title
        var node_user_list = this.$('.oe_follower_list').empty();
        this.$('.o_follower_title').html(this._format_followers(this.followers.length));
        self.message_is_follower = _.indexOf(this.followers.map(function (rec) { return rec[2]['is_uid'];}), true) != -1;
        // truncate number of displayed followers
        var truncated = this.followers.slice(0, this.displayed_nb);
        _(truncated).each(function (record) {
            var partner = {
                'id': record[0],
                'name': record[1],
                'is_uid': record[2]['is_uid'],
                'is_editable': record[2]['is_editable'],
                'avatar_url': mail_utils.get_image(session, 'res.partner', 'image_small', record[0]),
            };
            $(QWeb.render('mail.followers.partner', {'record': partner, 'widget': self})).appendTo(node_user_list);
            // On mouse-enter it will show the edit_subtype pencil.
            if (partner.is_editable) {
                self.$('.oe_follower_list').on('mouseenter mouseleave', function(e) {
                    self.$('.o_edit_subtype').toggleClass('o_hidden', e.type == 'mouseleave');
                    self.$('.oe_follower_list').find('.oe_partner').toggleClass('oe_partner_name', e.type == 'mouseenter');
                });
            }
        });
        // FVA note: be sure it is correctly translated
        if (truncated.length < this.followers.length) {
            $(QWeb.render('mail.followers.show_more', {'number': (this.followers.length - truncated.length)} )).appendTo(node_user_list);
        }
    },

    display_buttons: function () {
        if (this.message_is_follower) {
            this.$('button.o_follow_btn').removeClass('o_not_following').addClass('o_following');
        }
        else {
            this.$('button.o_follow_btn').removeClass('o_following').addClass('o_not_following');
        }

        if (this.view.is_action_enabled('edit')) {
            this.$('span.oe_mail_invite_wrapper').hide();
        }
        else {
            this.$('span.oe_mail_invite_wrapper').show();
        }
    },

    /** Fetch subtypes, only if current user is follower */
    fetch_subtypes: function (user_pid) {
        var self = this;
        var dialog = false;
        if (user_pid) {
            dialog = true;
        } else {
            if (! this.message_is_follower) {
                this.$('.o_subtype_dropdown_btn').attr('disabled', 'disabled');
                return;
            }
            else {
                this.$('.o_subtype_dropdown_btn').removeAttr('disabled');
            }
        }
        var id = this.view.datarecord.id;
        this.ds_model.call('message_get_subscription_data', [[id], user_pid, new data.CompoundContext(this.build_context(), {})])
            .then(function (data) {self.display_subtypes(data, id, dialog);});
    },

    /** Display subtypes: {'name': default, followed} */
    display_subtypes:function (data, id, dialog) {
        var self = this;
        var $list;
        if (dialog) {
            $list = self.dialog.$el;
        } else {
            $list = this.$('.o_subtype_list');
            $list.empty();
        }
        var records = data[id].message_subtype_data;
        this.records_length = $.map(records, function(value, index) { return index; }).length;
        if (this.records_length > 1) { self.display_followers(); }
        var old_model = '';
        _(records).each(function (record, record_name) {
            if (old_model != record.parent_model){
                if (old_model !== '') {
                    $list.append($('<li class="divider">'));
                }
                old_model = record.parent_model;
            }
            record.name = record_name;
            record.followed = record.followed || undefined;
            $(QWeb.render('mail.followers.subtype', {'record': record, 'dialog': dialog})).appendTo($list);
        });
    },

    do_follow: function () {
        var context = new data.CompoundContext(this.build_context(), {});
        this.$('.o_subtype_dropdown_btn').removeAttr('disabled');
        this.ds_model.call('message_subscribe_users', [[this.view.datarecord.id], [session.uid], undefined, context])
            .then(this.proxy('read_value'));
    },
    
    do_unfollow: function (user_pid) {
        if (confirm(_t("Warning! \nYou won't be notified of any email or discussion on this document. Do you really want to unfollow this document ?"))) {
            _(this.$('.oe_msg_subtype_check')).each(function (record) {
                $(record).attr('checked',false);
            });
            var action_unsubscribe = 'message_unsubscribe_users';
            this.$('.o_subtype_dropdown_btn').attr('disabled', 'disabled');
            var follower_ids = [session.uid];
            if (user_pid) {
                action_unsubscribe = 'message_unsubscribe';
                follower_ids = [user_pid];
            }
            var context = new data.CompoundContext(this.build_context(), {});
            return this.ds_model.call(action_unsubscribe, [[this.view.datarecord.id], follower_ids, context])
                 .then(this.proxy('read_value'));
        }
        return false;
    },

    do_update_subscription: function (event, user_pid) {
        var action_subscribe = 'message_subscribe_users';
        var follower_ids = [session.uid];
        var $subtype_items = this.$('.o_subtype_list li:not(.divider)');
        if (user_pid) {
            action_subscribe = 'message_subscribe';
            follower_ids = [user_pid];
            $subtype_items = this.dialog.$('li:not(.divider)');
        }
        var checklist = [];
        _($subtype_items).each(function (item) {
            if ($(item).hasClass('selected')) {
                checklist.push(parseInt($(item).data('id')));
            }
        });

        if (!checklist.length) {
            if (!this.do_unfollow(user_pid)) {
                this.on_item_clicked(event);
            } else {
                this.$('.o_subtype_dropdown_btn').parent().removeClass('open');
            }
        } else {
            var context = new data.CompoundContext(this.build_context(), {});
            return this.ds_model.call(action_subscribe, [[this.view.datarecord.id], follower_ids, checklist, context])
                .then(this.proxy('read_value'));
        }
    },
});
/* Add the widget to registry */
core.form_widget_registry.add('mail_followers', Followers);

});
