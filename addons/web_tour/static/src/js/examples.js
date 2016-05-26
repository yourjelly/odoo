odoo.define('web.tour_test', function(require) {
"use strict";

// TO REMOVE THIS BEFORE MERGING IN MASTER

var tour = require('web_tour.tour');

// tour.register('some tooltip', {
//     trigger: '.o_app[data-action-id="147"]',
//     title: 'Hello Project',
//     content: 'so much better than Trello',
//     position: 'bottom',
// });

// tour.register('kanban first record', {
//     trigger: '.o_kanban_view .o_kanban_record:first-child',
//     title: 'First kanban record',
//     content: 'You rock',
//     position: 'right',
// });


tour.register('project_example', [{
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_project_kanban',
    title: 'New project',
    content: 'Click here to create a new project',
    position: 'right',
}, {
    trigger: '.o_project_form h1',
    title: 'Choose a name',
    content: 'For example, FUCKFUCKFUCK',
    position: 'right',
}, {
    trigger: '.o_project_kanban .o_kanban_record:first-child',
    title: 'Open a project',
    content: 'Click here to open your new project',
    position: 'right',
}, {
    trigger: ".o_kanban_project_tasks .o_column_quick_create",
    title: "Add a state",
    content: "Tasks in a project are created in columns, representing their state in the project",
    position: "top right"
}, {
    trigger: ".o_kanban_project_tasks .o_kanban_quick_create",
    title: "Choose a stage name",
    content: "Don't worry, you can change it later if you want",
    position: "right"
}]);



// cruise.register('some_other_tour', {
//     url: "/some/url/action=13",
// }, [{
//     type: "tooltip",
//     trigger: "some css selector 1",
//     title: "tooltip 1 title",
//     content: "tooltip 1 content",
//     position: "bottom"
// }, {
//     type: "auto",
//     target: "some button css selector",
//     action: "click",
// }, {
//     type: "tooltip",
//     trigger: "some css selector 2",
//     title: "tooltip 2 title",
//     content: "tooltip 2 content",
//     position: "left"
// }, {
//     type: "auto",
//     target: "some button css selector",
//     action: "click",
// }, {
//     type: "tooltip",
//     trigger: "some css selector 3",
//     title: "tooltip 3 title",
//     content: "tooltip 3 content",
//     position: "right"
// }, {
//     type: "auto",
//     target: "some input css selector",
//     action: "fill",
//     text: "new content"
// }, {
//     type: "auto",
//     target: "some button css selector",
//     action: "click",
// }]);

});
