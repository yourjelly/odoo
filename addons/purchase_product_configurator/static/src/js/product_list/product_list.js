/** @odoo-module */

import { Component } from "@odoo/owl";
import { formatMonetary } from "@web/views/fields/formatters";
import { Product } from "../product/product";

export class ProductList extends Component {
    static components = { Product };
    static template = "purchaseProductConfigurator.productList";
    // static props = {
    //     products: Array,
    //     areProductsOptional: { type: Boolean, optional: true },
    // };
    static defaultProps = {
        areProductsOptional: false,
    };

    /**
     * Return the total of the product in the list, in the currency of the `purchase.order`.
     *
     * @return {String} - The sum of all items in the list, in the currency of the `purchase.order`.
     */
    getFormattedTotal() {
        return formatMonetary(
            this.props.products.reduce(
                (totalPrice, product) => totalPrice + product.price * product.quantity, 0
            ),
            {currencyId: this.env.currencyId},
        )
    }
}
