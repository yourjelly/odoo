/** @odoo-module**/
/* global ace */

import wTourUtils from "@website/js/tours/tour_utils";

const adminCssModif = '#wrap {display: none;}';
const demoCssModif = '// demo_edition';

function addCssNSaveEditor(trigger, demoCss = false) {
    return [
        {
            content: "add some scss content in the file",
            trigger: trigger,
            run: function () {
                ace.edit('ace-view-editor').getSession().insert({row: 2, column: 0}, `${demoCss===true?demoCssModif:adminCssModif}\n`);
            },
        },
        wTourUtils.saveHtmlEditor({extra_trigger: `div.ace_line:contains("${adminCssModif}")`}),
    ]
}
const openEditorNSelectScss = [
    ...wTourUtils.openSiteMenuAndHtmlEditor(),
    {
        content: "open type switcher",
        trigger: '.o_ace_type_switcher button',
    },
    {
        content: "select scss files",
        trigger: '.o_ace_type_switcher_choice[data-type="scss"]',
    },
    {
        content: "select 'user_custom_rules'",
        trigger: 'body:has(#ace-scss-list option:contains("user_custom_rules"))',
        run: function () {
            var scssId = $('#ace-scss-list option:contains("user_custom_rules")').val();
            $('#ace-scss-list').val(scssId).trigger('change');
        },
    }
];
const checkScssModified = function(stepOptions) {
    return Object.assign({}, {
        content: "check that the scss file was reset correctly, wrap content should now be visible again",
        trigger: 'iframe #wrap:visible',
        run: function () {}, // it's a check
    }, stepOptions);
}

wTourUtils.registerWebsitePreviewTour('html_editor_multiple_templates', {
    url: '/generic',
    edition: true,
    test: true,
},
    () => [
        {
            content: "drop a snippet",
            trigger: ".oe_snippet:has(.s_cover) .oe_snippet_thumbnail",
            // id starting by 'oe_structure..' will actually create an inherited view
            run: "drag_and_drop iframe #oe_structure_test_ui",
        },
        ...wTourUtils.clickOnSave(),
        // 2. Edit generic view
        ...wTourUtils.openSiteMenuAndHtmlEditor(),
        {
            content: "add something in the generic view",
            trigger: 'div.ace_line .ace_xml:contains("Generic")',
            run: function () {
                ace.edit('ace-view-editor').getSession().insert({row: 3, column: 1}, '<p>somenewcontent</p>\n');
            },
        },
        // 3. Edit oe_structure specific view
        {
            content: "select oe_structure specific view",
            trigger: 'div.ace_line .ace_xml:contains("somenewcontent")',
            run: function () {
                var viewId = $('#ace-view-list option:contains("oe_structure_test_ui")').val();
                $('#ace-view-list').val(viewId).trigger('change');
            },
        },
        {
            content: "add something in the oe_structure specific view",
            extra_trigger: '#ace-view-id:contains("test.generic_view_oe_structure_test_ui")', // If no xml_id it should show key
            trigger: 'div.ace_line .ace_xml:contains("s_cover")',
            run: function () {
                ace.edit('ace-view-editor').getSession().insert({row: 2, column: 1}, '<p>anothernewcontent</p>\n');
            },
        },
        wTourUtils.saveHtmlEditor(),
        {
           content: "check that the page has both modification",
           extra_trigger: 'iframe #wrapwrap:contains("anothernewcontent")',
           trigger: 'iframe #wrapwrap:contains("somenewcontent")',
           run: function () {}, // it's a check
       },
    ]
);

wTourUtils.registerWebsitePreviewTour('test_html_editor_scss', {
    url: '/contactus',
    test: true,
},
    () => [
        // 1. Open Html Editor and select a scss file
        ...openEditorNSelectScss,
        // 2. Edit that file and ensure it was saved then reset it
        ...addCssNSaveEditor('div.ace_line .ace_comment:contains("footer {")'),
        checkScssModified({timeout: 30000}),
        {
            content: "reset view (after reload, html editor should have been reopened where it was)",
            trigger: '#ace-view-id button[data-action="reset"]:not([disabled])',
        },
        {
            content: "confirm reset warning",
            trigger: '.modal-footer .btn-primary',
        },
        {
            content: "check that the scss file was reset correctly, wrap content should now be visible again",
            trigger: 'iframe #wrap:visible',
            run: function () {}, // it's a check
            timeout: 30000, // SCSS compilation might take some time
        },
        // 3. Customize again that file (will be used in second part of the test
        //    to ensure restricted user can still use the HTML Editor)
        ...addCssNSaveEditor('div.ace_line .ace_comment:contains("footer {")'),
        checkScssModified(),
    ]
);

wTourUtils.registerWebsitePreviewTour('test_html_editor_scss_2', {
    url: '/',
    test: true,
},
    () => [
        // This part of the test ensures that a restricted user can still use
        // the HTML Editor if someone else made a customization previously.

        // 4. Open Html Editor and select a scss file
        ...openEditorNSelectScss,
        // 5. Edit that file and ensure it was saved then reset it
        ...addCssNSaveEditor(`div.ace_line:contains("${adminCssModif}")`, true),
        {
            content: "reset view (after reload, html editor should have been reopened where it was)",
            trigger: '#ace-view-id button[data-action="reset"]:not([disabled])',
            timeout: 30000, // SCSS compilation might take some time
        },
        {
            content: "confirm reset warning",
            trigger: '.modal-footer .btn-primary',
        },
        {
            content: "check that the scss file was reset correctly",
            extra_trigger: `body:not(:has(div.ace_line:contains("${adminCssModif}")))`,
            trigger: `body:not(:has(div.ace_line:contains("${demoCssModif}")))`,
            run: function () {}, // it's a check
            timeout: 30000, // SCSS compilation might take some time
        },
    ]
);
