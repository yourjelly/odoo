odoo.define('sms.fields', function (require) {
"use strict";

var basic_fields = require('web.basic_fields');
var core = require('web.core');
var session = require('web.session');
var qweb = core.qweb;
var _t = core._t;
var Phone = basic_fields.FieldPhone

Phone.include({
    events: {
        'change input': '_onInputChange',
        'click button.o_field_phone_sms': '_onClickSMS',
    },

    start: function () {
        this._render();
    },

    _onClickSMS: function (ev) {
        ev.preventDefault();

        var context = session.user_context;
        context = _.extend({}, context, {
            default_res_model: this.model,
            default_res_id: parseInt(this.res_id),
            default_number_field_name: this.name,
            default_composition_mode: 'comment',
        });

        return this.do_action({
            title: _t('Send SMS Text Message'),
            type: 'ir.actions.act_window',
            res_model: 'sms.composer',
            target: 'new',
            views: [[false, 'form']],
            context: context,
        }, {
        on_close: () => {
            this.trigger_up('reload');
        }});
    },

    _onInputChange: function (ev) {
        this._setValue($(ev.target).val());
    },

    _render: function () {
        this._super();
        this.$el.html(qweb.render('field_phone_sms', {widget: this}));
    },
});

return Phone;

});
