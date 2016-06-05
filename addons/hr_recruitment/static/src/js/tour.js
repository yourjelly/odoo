odoo.define('hr_recruitment.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('hr_recruitment_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"], .oe_menu_toggler[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"]',
    content: 'Want to start recruiting like a pro? <b>Start here.</b>',
    position: 'bottom',
}, {
    trigger: '.o_kanban_button_new',
    extra_trigger: '.o_hr_recruitment_kanban',
    content: 'Let\'s create the first job position. (e.g. Sales, Marketing Officer)',
    position: 'right',
}, {
    trigger: ".o_back_button",
    extra_trigger: '.o_recruitment_job',
    content: "Use the breadcrumd to <b>go back to the dashboard</b>.",
    position: "bottom"
}, {
    trigger: ".oe_kanban_action_button",
    extra_trigger: '.o_hr_recruitment_kanban',
    content: "Let\' have a look at the applicants pipeline.",
    position: "bottom"
}

]);

});
