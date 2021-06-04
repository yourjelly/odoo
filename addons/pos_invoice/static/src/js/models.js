/* @odoo-module alias=pos_invoice.models */

import models from 'point_of_sale.models';

var _order_super = models.Order.prototype;
models.Order = models.Order.extend({
    export_as_JSON: function () {
        var result = _order_super.export_as_JSON.apply(this);
        result.paid_invoice_id = this.paid_invoice_id;
        return result;
    },
    init_from_JSON: function (json) {
        if (json.paid_invoice_id) {
            this.is_program_reward = json.paid_invoice_id;
        }
        _order_super.init_from_JSON.apply(this, [json]);
    },
});
