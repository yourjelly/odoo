/* @odoo-module */

import { registry } from "@web/core/registry";

export const posOrderNotify = {
    dependencies: ["bus_service"],
    start(env, { bus_service }) {
        return {
            notify(onNotify, sessionID) {
                bus_service.subscribe("pos_order_notify", ({ count, sessionid }) => {
                    if (sessionid == sessionID) {
                        onNotify(count);
                    }
                });
                bus_service.start();
            }
        }
    },
};

registry.category("services").add("pos_order_notify", posOrderNotify);
