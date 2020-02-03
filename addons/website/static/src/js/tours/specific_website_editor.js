odoo.define('website.tour.specific_website_editor', function (require) {
'use strict';

var tour = require('web_tour.tour');

tour.register('generic_website_editor', {
    test: true,
}, [{
    trigger: 'a[data-action=edit]',
    content: 'Click edit button',
}, {
    trigger: 'body:not([data-hello="world"])',
    content: 'Check that the editor DOM matches its website-generic features',
}]);

tour.register('specific_website_editor', {
    test: true,
}, [{
    trigger: 'a[data-action=edit]',
    content: 'Click edit button',
}, {
    trigger: 'body[data-hello="world"]',
    content: 'Check that the editor DOM matches its website-specific features',
}]);
});
