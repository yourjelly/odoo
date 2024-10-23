/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { Product } from '@sale/js/product/product';

patch(Product, {
    props: {
        ...Product.props,
        available_threshold: { type: Number, optional: true },
        free_qty: { type: Number, optional: true },
        qty: { type: Number, optional: true },
        show_availability: { type: Boolean, optional: true },
        uom_name : { type: String, optional: true },
    },
});

patch(Product.prototype, {
    /**
     * Check whether this product is out of stock.
     *
     * @return {Boolean} - Whether this product is out of stock.
     */
    isOutOfStock() {
        return !this.env.isQuantityAllowed(this.props, 1);
    },
});
