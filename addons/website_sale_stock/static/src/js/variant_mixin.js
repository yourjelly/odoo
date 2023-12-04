/** @odoo-module **/

import VariantMixin from '@website_sale/js/sale_variant_mixin';
import { patch } from "@web/core/utils/patch";
import publicWidget from "@web/legacy/js/public/public_widget";
import { renderToFragment } from "@web/core/utils/render";

import "@website_sale/js/website_sale";

import { markup } from "@odoo/owl";

/**
 * Update the renting text when the combination change.
 *
 * @param {Event} ev
 * @param {$.Element} $parent
 * @param {object} combination
 */

patch(VariantMixin, {
    /**
     * Addition to the variant_mixin._onChangeCombination
     *
     * This will prevent the user from selecting a quantity that is not available in the
     * stock for that product.
     *
     * It will also display various info/warning messages regarding the select product's stock.
     *
     * This behavior is only applied for the web shop (and not on the SO form)
     * and only for the main product.
     *
     * @param {Event} ev
     * @param {$.Element} $parent
     * @param {object} combination
     */
    _onChangeCombination(ev, $parent, combination) {
        const result = super._onChangeCombination(...arguments);
        let product_id = 0;
        // needed for list view of variants
        if ($parent.find('input.product_id:checked').length) {
            product_id = $parent.find('input.product_id:checked').val();
        } else {
            product_id = $parent.find('.product_id').val();
        }
        const isMainProduct = combination.product_id &&
            ($parent.is('.js_main_product') || $parent.is('.main_product')) &&
            combination.product_id === parseInt(product_id);

        if (!this.isWebsite || !isMainProduct) {
            return;
        }

        const $addQtyInput = $parent.find('input[name="add_qty"]');
        let qty = $addQtyInput.val();
        let ctaWrapper = $parent[0].querySelector('#o_wsale_cta_wrapper');

        if (!ctaWrapper) {
            // we're not strictly on the product page, but in the optional product modal
            // skip, should be supported in the future but isn't rn
            return result;
        }

        ctaWrapper.classList.replace('d-none', 'd-flex');

        if (combination.product_type === 'product' && !combination.allow_out_of_stock_order) {
            combination.free_qty -= parseInt(combination.cart_qty);
            $addQtyInput.data('max', combination.free_qty || 1);
            if (combination.free_qty < 0) {
                combination.free_qty = 0;
            }
            if (qty > combination.free_qty) {
                qty = combination.free_qty || 1;
                $addQtyInput.val(qty);
            }
            if (combination.free_qty < 1) {
                ctaWrapper.classList.replace('d-flex', 'd-none');
            }
        }

        $('.oe_website_sale')
            .find('.availability_message_' + combination.product_template)
            .remove();
        combination.has_out_of_stock_message = $(combination.out_of_stock_message).text() !== '';
        combination.out_of_stock_message = markup(combination.out_of_stock_message);
        $('div.availability_messages').append(renderToFragment(
            'website_sale_stock.product_availability',
            combination
        ));

        return result;
    }
});

publicWidget.registry.WebsiteSale.include({
    /**
     * Recomputes the combination after adding a product to the cart
     * @override
     */
    _onClickAdd(ev) {
        return this._super.apply(this, arguments).then(() => {
            if ($('div.availability_messages').length) {
                this._getCombinationInfo(ev);
            }
        });
    }
});
