odoo.define('sale.SaleMany2oneButton', function(require) {
    "use strict";
    var relational_fields = require('web.relational_fields');
    var core = require('web.core');
    var field_registry = require('web.field_registry');
    var dialogs = require('web.view_dialogs');

    var _t = core._t;

    var Many2OneButton = relational_fields.FieldMany2One.extend({
        start: function() {
            this._super.apply(this, arguments);
            this.set_button();
        },
        set_button: function() {
            var self = this;
            var $button = $('<button/>', {
                type: 'button',
                title: _t('Configure Attributes'),
            }).addClass('btn btn-sm btn-link fa fa-list');
            this.$el.html($button);
            $button.on('click', this.on_click.bind(this));
        },
        on_click: function(event) {
            var self = this;
            var context = this.record.getContext(this.recordParams);
            event.preventDefault();
            event.stopPropagation();
            this._rpc({
                    model: 'sale.attributes',
                    method: 'get_formview_id',
                    args: [
                        [this.value.res_id]
                    ],
                    context: context,
                })
                .then(function(view_id) {
                    new dialogs.FormViewDialog(self, {
                        res_model: 'sale.attributes',
                        res_id: self.value.res_id,
                        context: context,
                        title: _t("Open: ") + self.string,
                        view_id: view_id,
                        readonly: !self.can_write,
                        on_saved: function(record, changed) {
                            if (changed) {
                                self._setValue({ operation: 'ADD', id: record.res_id });
                            }
                        },
                    }).open();
                });
        },

    });
    field_registry.add('many2onebutton', Many2OneButton);
});