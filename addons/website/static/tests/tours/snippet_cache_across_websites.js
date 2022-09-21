/** @odoo-module **/

import wTourUtils from 'website.tour_utils';

wTourUtils.registerEditionTour('snippet_cache_across_websites', {
    edition: true,
    test: true,
    url: '/@/'
}, [
    {
        content: "Check that the custom snippet is displayed",
        trigger: '#snippet_custom_body span:contains("custom_snippet_test")',
        run: () => null,
    },
    ...wTourUtils.clickOnSave(), // There's no need to save, but canceling might or might not show a popup...
    {
        content: "Click on the website switch to switch to website 2",
        trigger: '.o_website_switcher_container button',
    },
    {
        content: "Switch to website 2",
        trigger: '.o_website_switcher_container .dropdown-item:nth-child(2)'
    },
    {
        content: "Wait for the iframe to be loaded",
        trigger: 'iframe html:not([data-website-id="1"])',
        run: () => null,
    },
    wTourUtils.clickOnEdit(),
    {
        content: "Check that the custom snippet is not here",
        trigger: '#oe_snippets:has(#snippet_custom.d-none)',
        run: () => null,
    },
]);
