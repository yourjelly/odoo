odoo.define('website_slides_sale.new_course', function (require) {
"use strict";

var core = require('web.core');
var rpc = require('web.rpc');
var base = require('web_editor.base');
var website = require('website.website');
var contentMenu = require('website.contentMenu');

var _t = core._t;

contentMenu.TopBar.include({
    new_course: function () {
        website.prompt({
            id: "editor_new_course",
            window_title: _t("New Course"),
            input: "Course Name",
        }).then(function (name) {
            website.form('/shop/add_course', 'POST', {
                name: name
            });
        });
    },
});
});