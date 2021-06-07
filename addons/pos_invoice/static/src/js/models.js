/* @odoo-module alias=pos_invoice.models */

import models from 'point_of_sale.models';

const existing_models = models.PosModel.prototype.models;
const product_index = _.findIndex(existing_models, function (model) {
    return model.model === 'product.product';
});
const product_model = existing_models[product_index];

models.load_models([
    {
        model: product_model.model,
        fields: product_model.fields,
        order: product_model.order,
        domain: function (self) {
            return [['id', '=', self.config.pay_invoice_product_id[0]]];
        },
        context: product_model.context,
        loaded: product_model.loaded,
    },
]);

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
