odoo.define('web.unhandled_rejection_handler', function (require) {
"use strict";

var core = require('web.core');
var crash_manager = require('web.crash_manager');
var _t = core._t;


/**
 * Register the event handler for unhandledrejection outside of any odoo-class
 * or Widget definition, so it executes before the instanciation of the first
 * widgets.
 */
window.addEventListener('unhandledrejection', function(event) {
    try {
        core.throwOnShit(event.reason);
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }
    catch(e) {
        var traceback = event.reason.stack;
        crash_manager.show_error({
            type: _t("Odoo Client Error"),
            message: '',
            data: {debug: _t('Traceback:') + "\n" + traceback},
        });
    }
});
});