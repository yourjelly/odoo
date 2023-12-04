/** @odoo-module **/

import { renderToElement } from "@web/core/utils/render";
import { patch } from "@web/core/utils/patch";
import VariantMixin from '@website_sale/js/sale_variant_mixin';

patch(VariantMixin, {
    /**
     * Displays additional info messages regarding the product's
     * stock and the wishlist.
     *
     * @param {Event} ev
     * @param {$.Element} $parent
     * @param {object} combination
     */
    _onChangeCombination(ev, $parent, combination) {
        const result = super._onChangeCombination(...arguments);
        if (this.el.querySelector('.o_add_wishlist_dyn')) {
            const messageEl = this.el.querySelector('div.availability_messages');
            if (messageEl && !this.el.querySelector('#stock_wishlist_message')) {
                messageEl.append(
                    renderToElement('website_sale_stock_wishlist.product_availability', combination) || ''
                );
            }
        }
        return result;
    }
});
