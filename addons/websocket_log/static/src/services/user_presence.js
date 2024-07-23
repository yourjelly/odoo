/** @odoo-module */

import { registry } from "@web/core/registry";

const AWAY_TRESHOLD = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL = 120; // 2 minutes.

const userPresenceService = {
    dependencies: ["bus_service", "presence"],

    start(env, services) {
        let lastSentPresence;
        setInterval(() => {
            if (
                Date.now() - services.presence.getLastPresence() < AWAY_TRESHOLD &&
                lastSentPresence !== "away"
            ) {
                services.bus_service.send("update_presence", "away");
            } else if (lastSentPresence !== "online") {
                services.bus_service.send("update_presence", "online");
            }
        }, CHECK_INTERVAL);
    },
};

registry.category("services").add("user.presence.service", userPresenceService);
