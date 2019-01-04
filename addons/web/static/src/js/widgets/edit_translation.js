odoo.define('web.PopupTranslate', function (require) {
"use strict";
var Widget = require('web.Widget');
var core = require('web.core');

var qweb = core.qweb;

var PopupTranslate = Widget.extend({
    // template: 'pouptranlate',
    events: {'change .o_translate_input' : '_onChangeInput'},

    init: function (parent, id, model, name) {
        this._super(parent);
        this.res_id = id,
        this.model = model,
        this.fieldName = name,
        this.changeInput = false;
    },
    willStart: function (){
        var self = this;
        this.translateData = {};
        var def = this._rpc({
            route: '/web/dataset/call_button',
            params: {
                model: 'ir.translation',
                method: 'edit_translate_fields',
                args: [this.model, this.res_id, this.fieldName],
            },
        }).then(function (values) {
            self.translateData = values;
        });
        return $.when(this._super.apply(this, arguments), def);
    },
    getContent: function () {
        return $(qweb.render('Translate.Popover', {result: this.translateData}));
    },
    start: function () {
        $('body').on('mouseup', this._onBodyClick.bind(this));
        this.$el.popover({
            template: $(Popover.Default.template).addClass('o_translate_field_popover')[0].outerHTML,
            container: this.$el,
            trigger: 'manual',
            placement: function (context, source) {
                return "left";
            },
            html: true,
            content : this.getContent.bind(this)
        });
    },
    _onBodyClick: function (ev) {
        if (this.$el.has(ev.target).length === 0 && !this.$el.is(ev.target)) {
            this.$el.popover('hide');
        }
    },
    showPopover: function () {
        this.$el.popover('toggle');
    },
    _onChangeInput: function (ev) {
        var self = this;
        this.changeInput = true;
        var $input = $(ev.currentTarget);
        _.find(self.translateData.data, function (res) {
            if (res.id === $($input).data('id')){
                res.value = $($input).val();
            }
        });
    },
    saveTranslation: function () {
        var self = this;
        if (this.changeInput) {
            _.map(this.translateData.data, function (record) {
                record.res_id = self.res_id;
                record.lang = record.lang.code;
                return self._rpc({
                    model: 'ir.translation',
                    method: 'write',
                    args: [record.id, record],
                });
            });
        }
    },
  
});
return PopupTranslate;
});
