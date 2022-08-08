odoo.define("stock_part.ProductItem", function (require) {
    const ProductItem = require("point_of_sale.ProductItem");
    const Registries = require('point_of_sale.Registries');

    const {useState} = owl;
    const {useListener} = require('web.custom_hooks');

    const ProductItemCB = x => class extends x {
        state = useState({on_hand: 0, quantity: 0})

        constructor() {
            super(...arguments);
            useListener('click', this.handleProductClick);
            this.updateQty();
            this.updateHand();
            this.autoRefresh = null;
        }

        mounted() {
            setTimeout(() => this._autoRefresh(this), 5000);
        }

        willUnmount() {
            clearTimeout(this.autoRefresh)
        }

        _autoRefresh(self) {
            self.updateHand();
            self.updateQty();
            this.trigger("update-product-list");
            self.autoRefresh = setTimeout(() => self._autoRefresh(self), 5000);
        }


        handleProductClick(e) {
            this.updateQty();
        }

        updateHand() {
            this.state.on_hand = this.env.pos.db.get_stock_by_product_id(this.props.product.id).available_quantity || 0;
        }

        updateQty() {
            const order = this.env.pos.get_order();
            this.state.quantity = order._get_overall_qty(this.props.product);
        }


    }

    Registries.Component.extend(ProductItem, ProductItemCB);
    return ProductItem;
});