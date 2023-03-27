/** @odoo-module */

import { ThreadService, threadService } from "@mail/core/thread_service";

import { patch } from "@web/core/utils/patch";

patch(ThreadService.prototype, "mail/web", {
    setup(env, services) {
        this._super(env, services);
        this.services = {
            /** @type {import("@mail/chat/chat_window_service").ChatWindowService} */
            "mail.chat_window": services["mail.chat_window"],
        };
    },
    open(thread, replaceNewMessageChatWindow) {
        if (!this.services["mail.store"].discuss.isActive || this.services["mail.store"].isSmall) {
            const chatWindow = this.services["mail.chat_window"].insert({
                folded: false,
                thread,
                replaceNewMessageChatWindow,
            });
            chatWindow.autofocus++;
            if (thread) {
                thread.state = "open";
            }
            this.services["mail.chat_window"].notifyState(chatWindow);
            return;
        }
        this._super(thread, replaceNewMessageChatWindow);
    },
});

patch(threadService, "mail/web", {
    dependencies: [...threadService.dependencies, "mail.chat_window"],
});
