odoo.define('mrp.mrp_state', function (require) {
"use strict";

var core = require('web.core');
var common = require('web.form_common');
var Model = require('web.Model');
var time = require('web.time');

var _t = core._t;


var SetBulletStatus = common.AbstractField.extend(common.ReinitializeFieldMixin,{
    init: function(field_manager, node) {
        this._super(field_manager, node);
        this.classes = this.options && this.options.classes || {};
    },
    render_value: function() {
        this._super.apply(this, arguments);
        if (this.get("effective_readonly")) {
            var bullet_class = this.classes[this.get('value')] || 'default';
            if (this.get('value')){
                var title = this.get('value') == 'waiting'? _t('Waiting Materials') : _t('Ready to produce');
                this.$el.attr({'title': title, 'style': 'display:inline'});
                this.$el.removeClass('text-success text-danger text-default');
                this.$el.html($('<span>' + title + '</span>').addClass('label label-' + bullet_class));
            }
        }
    },
});

var TimeCounter = common.AbstractField.extend(common.ReinitializeFieldMixin, {
    start: function() {
        this._super();
        var self = this;
        this.field_manager.on("view_content_has_changed", this, function () {
            self.render_value();
        });
    },
    start_time_counter: function(){
        var self = this;
        clearTimeout(this.timer);
        if (this.field_manager.datarecord.is_user_working) {
            this.duration += 1000;
            this.timer = setTimeout(function() {
                self.start_time_counter();
            }, 1000);
        } else {
            clearTimeout(this.timer);
        }
        this.$el.html($('<span>' + moment.utc(this.duration).format("HH:mm:ss") + '</span>'));
    },
    render_value: function() {
        this._super.apply(this, arguments);
        var self = this;
        this.duration;
        var productivity_domain = [['workorder_id', '=', this.field_manager.datarecord.id], ['user_id', '=', self.session.uid]];
        new Model('mrp.workcenter.productivity').call('search_read', [productivity_domain, []]).then(function(result) {
            if (self.get("effective_readonly")) {
                self.$el.removeClass('o_form_field_empty');
                var current_date = new Date();
                self.duration = 0;
                _.each(result, function(data) {
                    self.duration += data.date_end ? self.get_date_difference(data.date_start, data.date_end) : self.get_date_difference(time.auto_str_to_date(data.date_start), current_date);
                });
                self.start_time_counter();
            }
        });
    },
    get_date_difference: function(date_start, date_end) {
        var difference = moment(date_end).diff(moment(date_start));
        return moment.duration(difference);
    },
});

var PdfViewer = common.AbstractField.extend(common.ReinitializeFieldMixin, {
    tagName: 'iframe',
    className: 'o_form_field_pdfviewer',
    get_uri: function(){
        var query_obj = {
            model: this.view.dataset.model,
            field: this.name,
            id: this.view.datarecord.id
        };
        var query_string = $.param(query_obj);
        var url = encodeURIComponent('/web/image?' + query_string);
        // we can access static(pdfjs) assets of website even though website in not installed
        // we did the same in website_sign but what if someone rm -r /website for save cloud space ??
        return '/website/static/lib/pdfjs/web/viewer.html?file=' + url;
    },
    render_value: function() {
        this._super.apply(this, arguments);
        this.$el.attr('src', this.get_uri());
    },

});
core.form_widget_registry.add('bullet_state', SetBulletStatus)
                         .add('mrp_time_counter', TimeCounter)
                         .add('pdf_viewer', PdfViewer);
});
