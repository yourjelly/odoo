/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import wSaleUtils from "@website_sale/js/website_sale_utils";
import { rpc } from "@web/core/network/rpc";
import { debounce } from "@web/core/utils/timing";
import { Component } from "@odoo/owl";


publicWidget.registry.websiteSaleCart = publicWidget.Widget.extend({
    selector: '.oe_website_sale .oe_cart',
    events: {
        'click .js_delete_product': '_onClickDeleteProduct',
        'change input.js_quantity[data-product-id]': '_onChangeCartQuantity',
    },

    /**
     * @constructor
     */
    init: function () {
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
    _onClickDeleteProduct: function (ev) {
        ev.preventDefault();
        $(ev.currentTarget).closest('.o_cart_product').find('.js_quantity').val(0).trigger('change');
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onChangeCartQuantity: function (ev) {
        const input = ev.currentTarget;
        if (input.getAttribute('update_change')) {
            return;
        }
        this._changeCartQuantity(input);
    },

    /**
     * @private
     */
    _changeCartQuantity: function (input) {
        // TODO VFE like the matrix, hide number input arrows, now that the type of the input is number
        const value = parseInt(input.value || 0, 10);
        input.setAttribute('update_change', true);

        rpc("/shop/cart/update_json", {
            line_id: parseInt(input.dataset.lineId),
            product_id: parseInt(input.dataset.productId),
            set_qty: value,
            display: true,
        }).then((data) => {
            input.setAttribute('update_change', false);
            const check_value = parseInt(input.value || 0, 10);
            if (value !== check_value) {
                input.dispatchEvent(new Event('change'));
                return;
            }
            if (!data.cart_quantity) {
                // empty cart, reload the page
                return window.location = '/shop/cart';
            }
            input.value = data.quantity;

            wSaleUtils.updateCartNavBar(data);
            wSaleUtils.showWarning(data.notification_info.warning);

            // Propagating the change to the express checkout forms
            Component.env.bus.trigger('cart_amount_changed', [data.amount, data.minor_amount]);
        });
    },
});

export default publicWidget.registry.websiteSaleCart;
