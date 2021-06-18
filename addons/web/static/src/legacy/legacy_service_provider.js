/** @odoo-module **/

import { bus } from "web.core";
import { browser } from "../core/browser/browser";
import { registry } from "../core/registry";
import { handleDoAction } from "./action_adapters";

export const legacyServiceProvider = {
    dependencies: ["effect", "action"],
    start({ services }) {
        browser.addEventListener("show-effect", (ev) => {
            services.effect.add(ev.detail.type, ev.detail);
        });
        bus.on("show-effect", this, (payload) => {
            services.effect.add(payload.type, payload);
        });

        browser.addEventListener("do-action", (ev) => {
            handleDoAction(services.action, ev.detail);
        });
    },
};

registry.category("services").add("legacy_service_provider", legacyServiceProvider);
