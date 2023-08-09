/** @odoo-module **/

import Bus from "@web/legacy/js/core/bus";
import config from "@web/legacy/js/services/config";
import QWeb from "@web/legacy/js/core/qweb";
import Registry from "@web/legacy/js/core/registry";

/**
 * Whether the client is currently in "debug" mode
 *
 * @type Boolean
 */
export var bus = new Bus();

["click","dblclick","keydown","keypress","keyup"].forEach((evtype) => {
    $('html').on(evtype, function (ev) {
        bus.trigger(evtype, ev);
    });
});
["resize", "scroll"].forEach((evtype) => {
    $(window).on(evtype, function (ev) {
        bus.trigger(evtype, ev);
    });
});

export const qweb = new QWeb(config.isDebug());
export const serviceRegistry = new Registry();

export default {
    qweb: qweb,
    bus: bus,
    serviceRegistry: serviceRegistry,
};
