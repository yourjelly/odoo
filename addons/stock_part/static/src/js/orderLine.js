odoo.define("stock_part.orderLine", function (require) {
    const {_t} = require("web.core");
    const models = require("point_of_sale.models");
    const _orderline_super = models.Orderline.prototype;
    const _order_super = models.Order.prototype;
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const {Gui} = require('point_of_sale.Gui');

    models.Order = models.Order.extend({
        _get_overall_qty: function (product) {
            const orderlines = this.orderlines.models;
            const groups = _.groupBy(orderlines, ({product: {id}}) => id);
            return _.reduce(
                groups[product.id],
                (sum, orderline) => sum + orderline.quantity,
                0
            );
        },
        _check_stock: function (product, quantity) {
            const can_block = this.pos.config.block_when_no_stock;
            const on_hand = this.pos.db.get_stock_by_product_id(product.id).available_quantity || 0;
            const overall_qty = this._get_overall_qty(product);
            if (can_block && product.type == "product" && (overall_qty > on_hand && quantity !== 'remove' || !on_hand)) return {max: on_hand};
            return false;
        },
        add_product: function (product) {
            if (this._check_stock(product, 1)) return;
            _order_super.add_product.apply(this, arguments);
        },
    });

    models.Orderline = models.Orderline.extend({
        set_quantity: async function (quantity, keep_price) {
            _orderline_super.set_quantity.apply(this, arguments);
            const can_block = this.pos.config.block_when_no_stock;
            const {max} = this.order._check_stock(this.product, 0);
            if (!max || !can_block) return;
            await Gui.showPopup('ErrorPopup', {
                title: _t(`OUT OF STOCK`),
                body: _t(`Not enough stock for product ${this.product.display_name}, quantity has been set to ${max}`)
            })
            _orderline_super.set_quantity.call(this, max);
            NumberBuffer.set(`${max}`);
        },
    });
})