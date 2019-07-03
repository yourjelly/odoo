odoo.define("website.tour.restricted_editor", function (require) {
"use strict";

var tour = require("web_tour.tour");

tour.register("restricted_editor", {
    test: true,
    url: "/",
}, [{
    trigger: 'a[data-action=edit]',
    content: "Click \"EDIT\" button of website as Restricted Editor",
    extra_trigger: ".homepage",
}, {
    trigger: 'we3-dropblock.we3-snippets-loaded',
    content: "Check that the snippets loaded properly",
}]);
});
