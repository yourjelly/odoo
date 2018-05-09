odoo.define('library.AppSwitcher', function (require) {
"use strict";

var AppSwitcher = require('web_enterprise.AppSwitcher');
var core = require('web.core');

var QWeb = core.qweb;

var alreadyDisplayed = false;
AppSwitcher.include({
    render: function () {
        this._super.apply(this, arguments);
        if (moment().isoWeekday() === 5) {
            // only display on Mondays
            if (!alreadyDisplayed) {
                this.$el.prepend(QWeb.render('AppSwitcherWarning'));
                alreadyDisplayed = true;
            }
        }
    },
});

});