odoo.define('web.core', function (require) {
"use strict";

var Bus = require('web.Bus');
var Class = require('web.Class');
var config = require('web.config');
var QWeb = require('web.QWeb');
var Registry = require('web.Registry');
var translation = require('web.translation');

/**
 * Whether the client is currently in "debug" mode
 *
 * @type Boolean
 */
var bus = new Bus();

_.each('click,dblclick,keydown,keypress,keyup'.split(','), function (evtype) {
    $('html').on(evtype, function (ev) {
        bus.trigger(evtype, ev);
    });
});
_.each('resize,scroll'.split(','), function (evtype) {
    $(window).on(evtype, function (ev) {
        bus.trigger(evtype, ev);
    });
});

/**
 * Creates a rejections reason that is inherited from Error.
 * The OdooError will be ignored when caught by the global unhandledrejection
 * event on window and will not cause the crash manager to show the error.
 */
function rejectReason() {
    return new OdooError();
}

/**
 * Throw an error if the parameters reason is not of an expected type in Odoo
 * The expected types are either OdooError, undefined or an object {}.
 * Anything else will be throws as error
 *
 * @param {*} reason
 */
function throwOnShit(reason) {
    if (reason && !(reason instanceof OdooError) && reason instanceof Error) {
        throw reason;
    }
}

return {
    qweb: new QWeb(config.debug),

    // core classes and functions
    Class: Class,
    bus: bus,
    main_bus: new Bus(),
    _t: translation._t,
    _lt: translation._lt,

    // registries
    action_registry: new Registry(),
    crash_registry: new Registry(),
    serviceRegistry: new Registry(),
    /**
     * @type {String}
     */
    csrf_token: odoo.csrf_token,

    // promise catch and reject utilities
    rejectReason: rejectReason,
    throwOnShit: throwOnShit
};

});
