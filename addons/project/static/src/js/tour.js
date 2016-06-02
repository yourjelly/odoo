odoo.define('project.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('project_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="base.menu_main_pm"], .oe_menu_toggler[data-menu-xmlid="base.menu_main_pm"]',
    content: 'Let\'s have a look at the <b>Project app</b>.',
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_project_kanban',
    content: '<b>Create a project</b> that your team is working on.',
    position: 'right',
}, {
    trigger: 'input.o_project_name',
    content: 'Choose a <b>project name</b>. (e.g. Website Launch, Product Development, Office Party)',
    position: 'right',
}, {
    trigger: '.o_project_kanban .o_kanban_record:first-child',
    extra_trigger: 'body:not(.modal-open)',
    content: 'Click to <b>open your project</b>.',
    position: 'right',
}, {
    trigger: ".o_kanban_project_tasks .o_column_quick_create",
    content: "Add columns to setup <b>tasks stages</b>.<br/><i>e.g. Specification &gt; Development &gt; Tests</i>",
    position: "right"
}, {
    trigger: ".o-kanban-button-new",
    extra_trigger: '.o_kanban_project_tasks .o_kanban_group',
    content: "Now that the project is set up, <b>create a few tasks</b>.",
    position: "right"
}, {
    trigger: ".o_kanban_record:nth-child(3)",
    extra_trigger: '.o_kanban_project_tasks',
    content: "<b>Drag &amp; drop tasks</b> between columns as you work on them.",
    position: "right"
}, {
    trigger: ".o_back_button",
    extra_trigger: '.o_form_project_tasks',
    content: "Use the breadcrumd to <b>go back to tasks</b>.",
    position: "bottom"
}]);

});
