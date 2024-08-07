/** @odoo-module **/

import { registry } from "@web/core/registry";
import { redirect } from "@web/core/utils/urls";

// This tour relies on data created on the Python test.
registry.category("web_tour.tours").add('sale_signature', {
    test: true,
    url: '/my/quotes',
    steps: () => [
    {
        content: "open the test SO",
        trigger: 'a:contains(/^test SO$/)',
        run: "click",
    },
    {
        content: "click sign",
        trigger: 'a:contains("Sign")',
        run: "click",
    },
    {
        content: "click select style",
        trigger: ".modal .o_web_sign_auto_select_style button",
        run: "click",
    },
    {
        content: "click style 4",
        trigger: ".o-dropdown-item:eq(3)",
        run: "click",
    },
    {
        content: "wait signature is updated into the form values",
        trigger: ".modal input[name=signer]",
        async run() {
            await new Promise((r) => setTimeout(r, 200));
        },
    },
    {
        content: "click submit",
        trigger: ".modal .o_portal_sign_submit:enabled:contains(accept & sign)",
        run: "click",
    },
    {
        content: "check it's confirmed",
        trigger: '#quote_content:contains("Thank You")',
        run: "click",
    }, {
        trigger: '#quote_content',
        run: function () {
            redirect("/odoo");
        },  // Avoid race condition at the end of the tour by returning to the home page.
    },
    {
        trigger: 'nav',
    }
]});
