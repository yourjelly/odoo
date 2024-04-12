odoo.define("website.tour.foucus_inside_input", function (require) {
    "use strict";
    
    const wTourUtils = require('website.tour_utils');
    
    wTourUtils.registerWebsitePreviewTour('foucus_inside_input', {
        test: true,
        url: '/',
        edition: false,
    }, [
        ...wTourUtils.clickOnEditAndWaitEditMode(),
        {
            content: "Check whether the search filter input is focused",
            trigger: ".o_snippet_search_filter_input",
            run : () => {
                if (!document.activeElement.classList.contains('o_snippet_search_filter_input')) {
                    throw new Error("The search filter input is not focused");
                }
            }
        }
    ]);
});
