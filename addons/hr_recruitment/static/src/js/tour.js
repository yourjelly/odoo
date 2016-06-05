odoo.define('hr_recruitment.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('hr_recruitment_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"], .oe_menu_toggler[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"]',
    content: 'Want to <b>start recruiting</b> like a pro? <i>Start here.</i>',
    position: 'bottom',
}, {
    trigger: ".oe_kanban_action_button",
    extra_trigger: '.o_hr_recruitment_kanban',
    content: "Let\'s have a look at the <b>applications pipeline</b> for this job position.",
    position: "bottom"
}, {
    trigger: ".o_kanban_applicant .o_column_quick_create",
    content: "Add columns to define the <b>interview stages</b>.<br/><i>e.g. New &gt; Qualified &gt; First Interview &gt; Recruited</i>",
    position: "right"
}, {
    trigger: ".o_back_button",
    extra_trigger: '.o_kanban_applicant',
    content: "Use the breadcrumd to <b>go back to the dashboard</b>.",
    position: "bottom"
}, {
    trigger: ".o_job_alias",
    extra_trigger: '.o_hr_recruitment_kanban',
    content: "Try to send an email to this address, it will create an application automatically.",
    position: "bottom"
}]);

});
