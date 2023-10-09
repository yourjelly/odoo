/* @odoo-module */

import { busService } from "@bus/services/bus_service";
import { registry } from "@web/core/registry";

let busServiceInstance;
const patchedBusService = {
    ...busService,
    start(env) {
        busServiceInstance = busService.start(...arguments);
        busServiceInstance.env = env;
        return busServiceInstance;
    },
};
registry.category("services").add("bus_service", patchedBusService, { force: true });

registry.category("web_tour.tours").add("website_livechat.lazy_frontend_bus", {
    test: true,
    url: "/",
    steps: () => [
        {
            trigger: "body",
            async run() {
                await busServiceInstance.env.services["mail.messaging"].isReady;
                if (busServiceInstance.isActive) {
                    throw new Error("Bus service should not be started eagerly");
                }
            },
        },
    ],
});
