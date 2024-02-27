/** @odoo-module **/

import { registry } from "@web/core/registry";
import tourUtils from "@website_sale/js/tours/tour_utils";

registry.category("web_tour.tours").add(
    "website_sale.website_sale_shop_pricelist_tour",
    {
        test: true,
        url: '/shop',
        steps: () => [
            {
                content: "Check pricelist",
                trigger: ".o_pricelist_dropdown .dropdown-toggle:not(:contains('User Pricelist'))",
                run: function() {} // Check
            },
            {
                content: "Go to login page",
                trigger: ".btn:contains('Sign in')"
            },
            tourUtils.submitLogin({
                login: 'toto',
                password: 'long_enough_password',
                redirect: '/shop',
            }),
            {
                content: "Check pricelist",
                trigger: ".o_pricelist_dropdown .dropdown-toggle:contains('User Pricelist')",
                run: function() {} // Check
            },
        ]
    }
);
