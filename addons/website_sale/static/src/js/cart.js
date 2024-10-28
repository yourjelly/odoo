import { rpc } from "@web/core/network/rpc";
import { debounce } from "@web/core/utils/timing";
import publicWidget from "@web/legacy/js/public/public_widget";
import { Component } from "@odoo/owl";

import wSaleUtils from "@website_sale/js/website_sale_utils";


publicWidget.registry.websiteSaleCart = publicWidget.Widget.extend({
    selector: '#shop_cart',
    events: {
        'change input.js_quantity[data-product-id]': '_onChangeCartQuantity',
        'click .js_delete_product': '_onClickDeleteProduct',
        'click a.js_add_suggested_products': '_onClickSuggestedProduct',
    },

    /**
     * @constructor
     */
    init() {
        this._super.apply(this, arguments);

        this._changeCartQuantity = debounce(this._changeCartQuantity.bind(this), 500);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onChangeCartQuantity(ev) {
        return this._changeCartQuantity(ev.currentTarget);
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onClickDeleteProduct(ev) {
        ev.preventDefault();
        const input = document.querySelector(`input.js_quantity[data-line-id='${ev.currentTarget.dataset.lineId}']`)
        input.value = 0;
        this._changeCartQuantity(input);
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onClickSuggestedProduct(ev) {
        $(ev.currentTarget).prev('input').val(1).trigger('change');
    },

    /**
     * @private
     */
    async _changeCartQuantity(input) {
        const value = parseInt(input.value || 0, 10);
        const line_id = parseInt(input.dataset.lineId, 10);
        const productId = parseInt(input.dataset.productId, 10);

        const data = await rpc('/shop/cart/update_json', {
            line_id: line_id,
            product_id: productId,
            set_qty: value,
            display: true,
        })
        if (!data.cart_quantity) {
            // refresh the page to display the empty cart message
            return window.location = '/shop/cart';
        }

        const check_value = parseInt(input.value || 0, 10);
        if (value !== check_value) {
            this._changeCartQuantity(input);
            return;
        }

        input.value = data.quantity;

        wSaleUtils.updateCartNavBar(data);
        wSaleUtils.showWarning(data.notification_info.warning);

        // Propagating the change to the express checkout forms
        Component.env.bus.trigger('cart_amount_changed', [data.amount, data.minor_amount]);
    },
});

export default publicWidget.registry.websiteSaleCart;
