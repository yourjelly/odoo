/** @odoo-module **/

import { registry } from "@web/core/registry";

function patchWebsiteSaleTracking() {
    const websiteSaleTracking = odoo.loader.modules.get("@website_sale/js/website_sale_tracking")[Symbol.for('default')];
    websiteSaleTracking.include({
        // Purposely don't call super to avoid call to third party (GA) during tests
        _onViewItem(event, data) {
            $('body').attr('view-event-id', data.item_id);
        },
        _onAddToCart(event, data) {
            $('body').attr('cart-event-id', data.item_id);
        },
    });
}

let itemId;


registry.category("web_tour.tours").add('google_analytics_view_item', {
    test: true,
    url: '/shop?search=Customizable Desk',
    steps: [
    {
        content: "Patching websiteSaleTracking",
        trigger: 'body',
        run: () => {
            patchWebsiteSaleTracking();
        }
    },
    {
        content: "select customizable desk",
        trigger: '.oe_product_cart a:contains("Customizable Desk")',
    },
    {
        content: "wait until `_getCombinationInfo()` rpc is done",
        trigger: 'body[view-event-id]',
        timeout: 25000,
        run: () => {
            const $body = $('body');
            itemId = $body.attr('view-event-id');
            $body.removeAttr('view-event-id');
        }
    },
    {
        content: 'select another variant',
        extra_trigger: 'body:not([view-event-id])',
        trigger: 'ul.js_add_cart_variants ul.list-inline li:has(label.active) + li:has(label) input',
    },
    {
        content: 'wait until `_getCombinationInfo()` rpc is done (2)',
        // a new view event should have been generated, for another variant
        trigger: `body[view-event-id][view-event-id!=${itemId}]`,
        timeout: 25000,
        run: () => {}, // it's a check
    },
]});

registry.category("web_tour.tours").add('google_analytics_add_to_cart', {
    test: true,
    url: '/shop?search=Acoustic Bloc Screens',
    steps: [
    {
        content: "select Acoustic Bloc Screens",
        trigger: '.oe_product_cart a:contains("Acoustic Bloc Screens")',
    },
    {
        content: "click add to cart button on product page",
        trigger: '#add_to_cart',
    },
    {
        content: 'check add to cart event',
        extra_trigger: 'body[cart-event-id]',
        trigger: 'a:has(.my_cart_quantity:containsExact(1))',
        timeout: 25000,
        run: () => {}, // it's a check
    },
]});
