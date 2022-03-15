/** @odoo-module **/

import tour from 'web_tour.tour';
import tourUtils from 'website_sale.tour_utils';

tour.register('shop_list_view_b2c', {
    test: true,
    //url: '/shop?search=Test Product',
    url: '/shop?search=warranty',
},
    [
        {
            content: "check price on /shop",
            //trigger: '.oe_product_cart .oe_currency_value:contains("825.00")',
            trigger: '.oe_product_cart .oe_currency_value:contains("20.00")',
            run: function () {},
        },
        {
            content: "select product",
            //trigger: '.oe_product_cart a:contains("Test Product")',
            trigger: '.oe_product_cart a:contains("Warranty")',
        },
        {
            content: "check products list is disabled initially (when on /product page)",
            trigger: 'body:not(:has(.js_product_change))',
            extra_trigger: '#product_details',
            run: function () {},
        },
        {
            content: "go to edit mode",
            trigger: 'a.o_frontend_to_backend_edit_btn',
        },
        {
            content: "open customize tab",
            extra_trigger: '.editor_has_snippets',
            trigger: '.o_we_customize_snippet_btn',
        },
        {
            content: "open 'Variants' selector",
            trigger: '[data-name="variants_opt"] we-toggler',
        },
        {
            content: "click on 'Products List' of the 'Variants' selector",
            trigger: 'we-button[data-name="variants_products_list_opt"]',
        },
        {
            content: "check that the iframe is reloading",
            trigger: '.o_loading_dummy',
            run: () => {}, // It's a check.
        },
        {
            content: "click on save button after the reload",
            trigger: 'div:not(.o_loading_dummy) > #oe_snippets button[data-action="save"]',
            run: 'click',
        },
        {
            content: "check page loaded after 'Products List' enabled",
            trigger: 'iframe .js_product_change',
            run: function () {},
        },
        {
            context: "check variant price",
            //trigger: 'iframe .custom-radio:contains("Aluminium") .badge:contains("+") .oe_currency_value:contains("55.44")',
            trigger: 'iframe .custom-radio:contains("2 year") .badge:contains("+") .oe_currency_value:contains("18.00")',
            run: function () {},
        },
        {
            content: "check price is 825",
            //trigger: 'iframe .product_price .oe_price .oe_currency_value:containsExact(825.00)',
            trigger: 'iframe .product_price .oe_price .oe_currency_value:containsExact(20.00)',
            run: function () {},
        },
        {
            content: "switch to another variant",
            //trigger: 'iframe .js_product label:contains("Aluminium")',
            trigger: 'iframe .js_product label:contains("2 year")',
        },
        {
            content: "verify that price has changed when changing variant",
            //extra_trigger: 'iframe .product_price .oe_price .oe_currency_value:not(:containsExact(825.00))',
            extra_trigger: 'iframe .product_price .oe_price .oe_currency_value:not(:containsExact(20.00))',
            //trigger: 'iframe .product_price .oe_price .oe_currency_value:containsExact(880.44)',
            trigger: 'iframe .product_price .oe_price .oe_currency_value:containsExact(38.00)',
            run: function () {},
        },
        {
            content: "click on 'Add to Cart' button",
            trigger: 'iframe a:contains(ADD TO CART)',
        },
        {
            content: "waiting for quantity in the cart",
            trigger: "iframe a:has(.my_cart_quantity:containsExact(1))",
            run: function () {},
        },
        //     tourUtils.goToCart({backend: true}),
        {
            content: "check price on /cart",
            //trigger: 'iframe #cart_products .oe_currency_value:containsExact(880.44)',
            trigger: 'iframe #cart_products .oe_currency_value:containsExact(38.00)',
            run: function () {},
        },
    ],
);
