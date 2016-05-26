odoo.define('web.tour_test', function(require) {
"use strict";

// TO REMOVE THIS BEFORE MERGING IN MASTER

var tour = require('web_tour.tour');

tour.register('some tooltip', {
    trigger: '.o_app[data-action-id="389"]',
    title: 'Hello Project',
    content: 'so much better than Trello',
    position: 'bottom',
});

tour.register('kanban first record', {
    trigger: '.o_kanban_view .o_kanban_record:first-child',
    title: 'First kanban record',
    content: 'You rock',
    position: 'right',
});


tour.register('some_tour', [{
    trigger: "some css selector 1",
    title: "tooltip 1 title",
    content: "tooltip 1 content",
    position: "bottom"
}, {
    trigger: "some css selector 2",
    title: "tooltip 2 title",
    content: "tooltip 2 content",
    position: "left"
}, {
    trigger: "some css selector 3",
    title: "tooltip 3 title",
    content: "tooltip 3 content",
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
