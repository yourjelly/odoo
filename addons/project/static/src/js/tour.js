odoo.define('project.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('project_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="base.menu_main_pm"], .oe_menu_toggler[data-menu-xmlid="base.menu_main_pm"]',
    content: 'so much better than Trello',
    position: 'bottom',
}, {
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_project_kanban',
    content: 'Click here to <b>create</b> a new project',
    position: 'right',
}, {
    trigger: '.o_project_form h1 input',
    content: 'Write the project title',
    position: 'right',
}, {
    trigger: '.o_menu_sections li a[data-menu-xmlid="project.menu_projects"], .oe_menu_leaf[data-menu-xmlid="project.menu_projects"]',
    extra_trigger: '.o_project_form.o_form_readonly',
    content: 'Project can be accessed from the dashboard',
    position: 'bottom',
}, {
    trigger: '.o_project_kanban .o_kanban_record:first-child',
    content: 'Click here to open your new project',
    position: 'right',
}, {
    trigger: ".o_kanban_project_tasks .o_column_quick_create",
    content: "Tasks in a project are created in columns, representing their state in the project",
    position: "right"
}, {
    trigger: ".o_kanban_project_tasks .o_kanban_quick_create input",
    content: "Don't worry, you can change it later if you want",
    position: "right"
}]);

});
