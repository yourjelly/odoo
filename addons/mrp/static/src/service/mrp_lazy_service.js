/** @odoo-module **/

import { registry } from "@web/core/registry";

export const mrpLazyService = {
    dependencies: ["orm"],
    start(env, { orm }) {
        let groupedIDs = [];
        let isCallScheduled = false;
        let prom;
        return {
            async call(id) {
                groupedIDs.push(id);
                if (!isCallScheduled) {
                    isCallScheduled = true;
                    await Promise.resolve(); // wait for a tick to batch all requests
                    const ids = groupedIDs;
                    prom = orm.read("mrp.production", ids, [
                        "components_availability",
                        "components_availability_state",
                        "reservation_state",
                    ]);
                    groupedIDs = [];
                    isCallScheduled = false;
                }
                await Promise.resolve(); // wait for the prom to be created
                const result = await prom;
                return result ? result.find((item) => item["id"] == id) : false;
            },
        };
    },
};

registry.category("services").add("mrp_lazy_loading", mrpLazyService);
