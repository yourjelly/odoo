/** @odoo-module **/

import { registry } from "@web/core/registry";

const DELAY = 60000;

export const trackerService = {
    dependencies: ["multi_tab", "user","action"],

    start(env, { multi_tab, user }) {
        let updateTrackerServiceTimeout;
        const throttledUpdateTrackerService = _.throttle(
            function updateTrackerService() {
                clearTimeout(updateTrackerServiceTimeout);
                if (!multi_tab.isOnMainTab()) {
                    return;
                };
                navigator.geolocation.getCurrentPosition(onSuccess, onError, {
                    timeout: 10000,
                });
                function onSuccess(position) {
                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    user.updateContext({ coords });
                    console.log("Your coordinate is: Lat: " + position.coords.latitude, position.coords.longitude);
                    let context = {
                        'coords': coords
                    };
                    env.services.action.doAction("base_partner_tracker.model_mail_message_partner_tracker",{},context);
                }
                function onError(err) {
                    // if needed to generate error
                    // switch (err.code) {
                    //     case 1:
                    //         env.services.notification.add("Please Allow Location Access...", { type: "warning" });
                    //         env.services.rpc("/base_partner_tracker/location_access_error", {
                    //             err: {
                    //                 code: err.code,
                    //                 message: err.message,
                    //             }
                    //         });
                    //         break;
                    //     default:
                    //         env.services.notification.add(`ERROR(${err.code}): ${err.message}`, {
                    //             type: "warning",
                    //         });
                    //         break;
                    // }
                }
                updateTrackerServiceTimeout = setTimeout(throttledUpdateTrackerService, DELAY);
            },
            DELAY
        );
        throttledUpdateTrackerService();
        multi_tab.bus.addEventListener("become_main_tab", throttledUpdateTrackerService);
        multi_tab.bus.addEventListener("no_longer_main_tab", () => { clearTimeout(updateTrackerServiceTimeout); });
    },
}

registry.category("services").add("trackerService", trackerService);
