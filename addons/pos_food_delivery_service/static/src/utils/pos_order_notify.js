import { registry } from "@web/core/registry";

export const posOrderNotify = {
    dependencies: ["bus_service"],
    start(env, { bus_service }) {
        return {
            notify(onNotify, sessionID) {
                bus_service.subscribe("pos_order_notify", ({ count, session_id }) => {
                    if (session_id == sessionID) {
                        onNotify(count);
                    }
                });
                bus_service.start();
            }
        }
    },
};

registry.category("services").add("pos_order_notify", posOrderNotify);