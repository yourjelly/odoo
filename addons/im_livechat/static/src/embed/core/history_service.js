/* @odoo-module */

import { registry } from "@web/core/registry";

export class HistoryService {
    static HISTORY_COOKIE = "im_livechat_history";

    constructor(env, { "im_livechat.livechat": livechatService, bus_service, rpc }) {
        this.busService = bus_service;
        this.livechatService = livechatService;
        this.rpc = rpc;
    }

    setup() {
        this.busService.subscribe("im_livechat.history_command", ({ id }) =>
            // this.livechatService.thread?.id !== id => same channel
            console.warn("===== received", payload)
        );
    }
}

export const autoPopupService = {
    dependencies: ["im_livechat.livechat", "bus_service", "rpc"],

    start(env, services) {
        const history = new HistoryService(env, services);
        history.setup();
    },
};
registry.category("services").add("im_livechat.history", autoPopupService);
