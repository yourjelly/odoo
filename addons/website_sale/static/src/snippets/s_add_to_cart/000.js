/** @odoo-module **/

import publicWidget from 'web.public.widget';
import { cartHandlerMixin } from 'website_sale.utils';
import { WebsiteSale } from 'website_sale.website_sale';
import { _t } from 'web.core';

publicWidget.registry.AddToCartSnippet = WebsiteSale.extend(cartHandlerMixin, {
    selector: '.s_add_to_cart_btn',
    events: {
        'click': '_onClickAddToCartButton',
    },

    _onClickAddToCartButton: async function (ev) {
        const dataset = ev.currentTarget.dataset;

        const visitorChoice = dataset.visitorChoice === 'true';
        const action = dataset.action;
        const productId = parseInt(dataset.productVariantId);

        if (!productId) {
            return;
        }

        if (visitorChoice) {
            // clone `Add to Cart` button to retrieve the productId from hidden
            // input and append to `o_shared_block` to make the modal behaviour
            // possible, and remove it from o_shared_block after modal.
            const clonedBtnEl = ev.currentTarget.cloneNode(true);
            clonedBtnEl.classList.add('d-none');
            // TODO: remove jQuery, check for _handleAdd .find
            const $selector = $('#o_shared_blocks');
            $selector[0].appendChild(clonedBtnEl);
            await this._handleAdd($selector);
            $selector[0].removeChild(clonedBtnEl);
        } else {
            const isAddToCartAllowed = await this._rpc({
                route: `/shop/product/is_add_to_cart_allowed`,
                params: {
                    product_id: productId,
                },
            });
            if (!isAddToCartAllowed) {
                this.displayNotification({
                    title: 'User Error',
                    message: _t('This product does not exist therefore it cannot be added to cart.'),
                    type: 'warning'
                });
                return;
            }
            this.isBuyNow = action === 'buy_now';
            this.stayOnPageOption = !this.isBuyNow;
            this.addToCart({product_id: productId, add_qty: 1});
        }
    },
});

export default publicWidget.registry.AddToCartSnippet;
