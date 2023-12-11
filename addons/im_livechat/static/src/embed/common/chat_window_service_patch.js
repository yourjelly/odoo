/* @odoo-module */

import { ChatWindowService } from "@mail/core/common/chat_window_service";
import { patch } from "@web/core/utils/patch";
import { SESSION_STATE } from "./livechat_service";

patch(ChatWindowService.prototype, {
    shouldNotifyFoldState(thread) {
        if (thread?.type === "livechat") {
            return this.env.services["im_livechat.livechat"].state === SESSION_STATE.PERSISTED;
        }
        return super.shouldNotifyFoldState(thread);
    },
});
