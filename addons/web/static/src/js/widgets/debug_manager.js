odoo.define('web.DebugManager', function (require) {
"use strict";

var core = require('web.core');
var Dialog = require('web.Dialog');
var formats = require('web.formats');
var framework = require('web.framework');
var session = require('web.session');
var utils = require('web.utils');
var ViewManager = require('web.ViewManager');
var WebClient = require('web.WebClient');
var Widget = require('web.Widget');

var QWeb = core.qweb;
var _t = core._t;

if (core.debug) {
    var DebugManager = Widget.extend({
        template: "WebClient.DebugManager",
        events: {
            "click .o-debug-dropdowns li>ul>li": "perform_callback",
            "click .o-debug-leave": "leave_debug",
        },
        start: function() {
            this._super();
            this.$dropdowns = this.$(".o-debug-dropdowns");
        },
        /**
         * Update the DebugManager according to the current widget
         * Hide it if the widget isn't a ViewManager
         * @param {web.Widget} [widget] the current widget
         */
        update: function(widget) {
            var available = false;
            if (widget instanceof ViewManager) {
                available = true;
                if (widget !== this.view_manager) {
                    this.view_manager = widget;

                    // Update itself each time switch_mode is performed on the ViewManager
                    this.view_manager.on('switch_mode', this, function() {
                        this.update(this.view_manager);
                    });
                }
                this.dataset = this.view_manager.dataset;
                this.active_view = this.view_manager.active_view;
                this.view = this.active_view.controller;

                // Remove the previously rendered dropdowns
                this.$dropdowns.empty();
                this.session.user_has_group('base.group_system').then(function(is_admin) {
                    // Render the new dropdowns and append them
                    var new_dropdowns = QWeb.render('WebClient.DebugDropdowns', {
                        widget: this,
                        active_view: this.active_view,
                        view: this.view,
                        action: this.view_manager.action,
                        searchview: this.view_manager.searchview,
                        is_admin: is_admin,
                        view_ids_length: this.active_view.type === 'form' && this.view.get_selected_ids().length,
                    });
                    $(new_dropdowns).appendTo(this.$dropdowns);
                });
            }

            this.$el.toggle(available);
        },
        /**
         * Calls the appropriate callback when clicking on a Debug option
         */
        perform_callback: function (evt) {
            evt.preventDefault();
            var params = $(evt.target).data();
            var callback = params.action;

            if (callback && this[callback]) {
                // Perform the callback corresponding to the option
                this[callback](params, evt);
            } else {
                console.warn("No debug handler for ", callback);
            }
        },
        get_metadata: function() {
            var self = this;
            var ids = this.view.get_selected_ids();
            self.dataset.call('get_metadata', [ids]).done(function(result) {
                new Dialog(this, {
                    title: _.str.sprintf(_t("Metadata (%s)"), self.dataset.model),
                    size: 'medium',
                    buttons: {
                        Ok: function() { this.parents('.modal').modal('hide');}
                    },
                }, QWeb.render('WebClient.DebugViewLog', {
                    perm : result[0],
                    format : formats.format_value
                })).open();
            });
        },
        toggle_layout_outline: function() {
            this.view.rendering_engine.toggle_layout_debugging();
        },
        set_defaults: function() {
            this.view.open_defaults_dialog();
        },
        perform_js_tests: function() {
            this.do_action({
                name: _t("JS Tests"),
                target: 'new',
                type : 'ir.actions.act_url',
                url: '/web/tests?mod=*'
            });
        },
        get_view_fields: function() {
            var self = this;
            self.dataset.call('fields_get', [false, {}]).done(function (fields) {
                var $root = $('<dl>');
                _(fields).each(function (attributes, name) {
                    $root.append($('<dt>').append($('<h4>').text(name)));
                    var $attrs = $('<dl>').appendTo($('<dd>').appendTo($root));
                    _(attributes).each(function (def, name) {
                        if (def instanceof Object) {
                            def = JSON.stringify(def);
                        }
                        $attrs
                            .append($('<dt>').text(name))
                            .append($('<dd style="white-space: pre-wrap;">').text(def));
                    });
                });
                new Dialog(self, {
                    title: _.str.sprintf(_t("Model %s fields"),
                                         self.dataset.model),
                    buttons: {
                        Ok: function() { this.parents('.modal').modal('hide');}
                    },
                }, $root).open();
            });
        },
        fvg: function() {
            var dialog = new Dialog(this, { title: _t("Fields View Get") }).open();
            $('<pre>').text(utils.json_node_to_xml(this.view.fields_view.arch, true)).appendTo(dialog.$el);
        },
        manage_filters: function() {
            this.do_action({
                res_model: 'ir.filters',
                name: _t('Manage Filters'),
                views: [[false, 'list'], [false, 'form']],
                type: 'ir.actions.act_window',
                context: {
                    search_default_my_filters: true,
                    search_default_model_id: this.dataset.model
                }
            });
        },
        translate: function() {
            this.do_action({
                name: _t("Technical Translation"),
                res_model : 'ir.translation',
                domain : [['type', '!=', 'object'], '|', ['name', '=', this.dataset.model], ['name', 'ilike', this.dataset.model + ',']],
                views: [[false, 'list'], [false, 'form']],
                type : 'ir.actions.act_window',
                view_type : "list",
                view_mode : "list"
            });
        },
        edit: function(params, evt) {
            this.do_action({
                res_model : params.model,
                res_id : params.id,
                name: evt.target.text,
                type : 'ir.actions.act_window',
                view_type : 'form',
                view_mode : 'form',
                views : [[false, 'form']],
                target : 'new',
                flags : {
                    action_buttons : true,
                    headless: true,
                }
            });
        },
        edit_workflow: function() {
            return this.do_action({
                res_model : 'workflow',
                name: _t('Edit Workflow'),
                domain : [['osv', '=', this.dataset.model]],
                views: [[false, 'list'], [false, 'form'], [false, 'diagram']],
                type : 'ir.actions.act_window',
                view_type : 'list',
                view_mode : 'list'
            });
        },
        print_workflow: function() {
            debugger;
            if (this.view.get_selected_ids && this.view.get_selected_ids().length == 1) {
                framework.blockUI();
                var action = {
                    context: { active_ids: this.view.get_selected_ids() },
                    report_name: "workflow.instance.graph",
                    datas: {
                        model: this.dataset.model,
                        id: this.view.get_selected_ids()[0],
                        nested: true,
                    }
                };
                this.session.get_file({
                    url: '/web/report',
                    data: {action: JSON.stringify(action)},
                    complete: framework.unblockUI
                });
            } else {
                this.do_warn("Warning", "No record selected.");
            }
        },
        leave_debug: function() {
            window.location.search="?";
        },
    });

    WebClient.include({
        show_common: function() {
            var self = this;
            this._super();

            // Instantiate the DebugManager and insert it into the DOM
            this.debug_manager = new DebugManager(this);
            this.debug_manager.appendTo(this.$('.o-web-client'));

            // Override push_action so that it triggers an event each time a new action is pushed
            // The DebugManager listens to this even to keep itself up-to-date
            var push_action = this.action_manager.push_action;
            this.action_manager.push_action = function() {
                return push_action.apply(self.action_manager, arguments).then(function() {
                    self.debug_manager.update(self.action_manager.get_inner_widget());
                });
            };

        },
    });

    return DebugManager;
}

});
