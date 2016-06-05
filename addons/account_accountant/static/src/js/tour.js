odoo.define('account_accountant.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('account_accountant_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="account.menu_finance"], .oe_menu_toggler[data-menu-xmlid="account.menu_finance"]',
    content: 'Ready to <b>discover an awesome accounting</b> app? <i>Follow the tips</i>.',
    position: 'bottom',
}, {
    trigger: ".o-invoice-new",
    extra_trigger: '.o_account_kanban',
    content: "Let\'s create a customer invoice.",
    position: "bottom"
}, {
    trigger: ".o_back_button",
    extra_trigger: "[data-id='open'].btn-primary",
    content: "Use the breadcrumd to easily <b>go back to preceeding screens.</b>",
    position: "bottom"
}, { // TODO: this step does not seems to work, the XML_ID is not on the menu
    trigger: 'li[data-menu-xmlid="account.menu_finance_reports"], li[data-menu-xmlid="account.menu_finance_reports"]',
    content: "Your reports are available in real time. <i>No need to close a fiscal year to get a Profit &amp; Loss statement or a Balance Sheet.</i>",
    position: "bottom"
}]);

});
