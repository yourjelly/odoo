/** @odoo-module **/

import wTourUtils from '@website/js/tours/tour_utils';

function assertEqual(actual, expected) {
    if (actual !== expected) {
        throw new Error(`Assert failed: expected: ${expected} ; got: ${actual}`);
    }
}

wTourUtils.registerWebsitePreviewTour('website_controller_page_listing_layout', {
    test: true,
    url: '/model/exposed-model',
    edition: true,
}, () => [
    {
        content: "website is in preview mode",
        trigger: '.o_website_preview',
    },
    {
        content: "records are listed in grid mode by default",
        trigger: 'iframe .o_website_grid',
        run: () => {}, // It's a check.
    },
    {
        content: "open customize tab",
        trigger: '.o_we_customize_snippet_btn',
        run: async () => {
            console.info("LUVI BEFORE CLICK")
            console.info(document.querySelector(".o_we_customize_snippet_btn").innerHTML);
            document.querySelector(".o_we_customize_snippet_btn").click();
            console.info("LUVI STEP SUCCESSFUL open customize tab")
        },
    },
    {
        content: "open 'Layout' selector",
        extra_trigger: '#oe_snippets .o_we_customize_panel',
        trigger: '#oe_snippets .o_we_customize_panel we-toggler',
        run: async () => {
            console.info("LUVI BEFORE CLICK")
            console.info(document.querySelector("#oe_snippets").innerHTML)
            document.querySelector("#oe_snippets .o_we_customize_panel we-toggler").click();
            console.info("LUVI STEP SUCCESSFUL LAYOUT")
        },
    },
    {
        content: "click on 'List' option of the 'Layout' selector",
        trigger: '.o_we_user_value_widget we-button[data-name="list_view_opt"]',
        run: async () => {
            console.info("LUVI BEFORE CLICK")
            document.querySelector(".o_we_user_value_widget we-button[data-name='list_view_opt']").click();
            console.info("LUVI STEP SUCCESSFUL LAYOUT")
        },
    },
    {
        content: "records are now displayed in list mode",
        trigger: 'iframe .o_website_list',
        run: () => {
            const iframeDocument = document.querySelector('.o_website_preview .o_iframe').contentDocument;
            // list option is now selected in the switch
            assertEqual(iframeDocument.querySelector(".listing_layout_switcher #o_wstudio_apply_list").checked, true);
        },
    },
    ...wTourUtils.clickOnSave(),
]);

wTourUtils.registerWebsitePreviewTour('website_controller_page_default_page_check', {
    test: true,
    url: '/model/exposed-model',
}, () => [
    {
        content: "records are listed in list mode by default",
        trigger: 'iframe .o_website_list',
        run: () => {
            const iframeDocument = document.querySelector('.o_website_preview .o_iframe').contentDocument;
            // list option is selected by default in the switch
            assertEqual(iframeDocument.querySelector(".listing_layout_switcher #o_wstudio_apply_list").checked, true);
            assertEqual([...iframeDocument.querySelectorAll(".test_record_listing")].length, 2);
        },
    },
]);
