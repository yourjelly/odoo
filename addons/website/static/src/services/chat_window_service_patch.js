/* @odoo-module */

import { chatWindowService, ChatWindowService } from "@mail/web/chat_window/chat_window_service";

import { patch } from "@web/core/utils/patch";

chatWindowService.dependencies.push("website");

patch(ChatWindowService.prototype, "website/chat_window_service", {
    get visible() {
       return this.env.services.website.isPreviewOpen ? [] : this._super();
    },
});
