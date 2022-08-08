odoo.define("stock_part.PaymentScreen", function (require) {
    const {_t} = require("web.core");
    const PaymentScreen = require("point_of_sale.PaymentScreen");
    const Registries = require('point_of_sale.Registries');

    const PaymentScreenCB = x => class extends x {
        async _finalizeValidation() {
            const order = this.currentOrder;
            const orderlines = order.get_orderlines();
            for (let line of orderlines) {
                const product_id = line.product.id;
                const qty = line.quantity;
                this.env.pos.db.force_update_stock_by_product_id(product_id, -qty);
            }
            return super._finalizeValidation();
        }
    }

    Registries.Component.extend(PaymentScreen, PaymentScreenCB);
    return PaymentScreen;
})