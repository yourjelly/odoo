/** @odoo-module **/

import Bus from "@web/legacy/js/core/bus";
import config from "./config";
import Class from "@web/legacy/js/core/class";
import QWeb from "@web/legacy/js/core/qweb";
import Registry from "@web/legacy/js/core/registry";
import translation from "@web/legacy/js/core/translation";

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

export const qweb = new QWeb(config.isDebug());

// core classes and functions
export const Class = Class;
export const bus = bus;
export const main_bus = new Bus();
export const _t = translation._t;
export const _lt = translation._lt;

// registries
export const action_registry = new Registry();
export const crash_registry = new Registry();
export const serviceRegistry = new Registry();
/**
 * @type {String}
 */
export const csrf_token = odoo.csrf_token;
