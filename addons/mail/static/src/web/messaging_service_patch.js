/** @odoo-module */

import { Messaging, messagingService } from "@mail/core/messaging_service";
import { createLocalId } from "@mail/utils/misc";
import { patch } from "@web/core/utils/patch";

patch(Messaging.prototype, "mail/web", {
    setup(env, services, initialThreadLocalId) {
        this._super(env, services, initialThreadLocalId);
        Object.assign(this.services, {
            /** @type {import("@mail/chat/chat_window_service").ChatWindow} */
            "mail.chat_window": services["mail.chat_window"],
        });
    },
    initMessagingCallback(data) {
        this.loadFailures();
        for (const channelData of data.channels) {
            const thread = this.services["mail.thread"].createChannelThread(channelData);
            if (channelData.is_minimized && channelData.state !== "closed") {
                this.services["mail.chat_window"].insert({
                    autofocus: 0,
                    folded: channelData.state === "folded",
                    thread,
                });
            }
        }
        this._super(data);
    },
    async _handleNotificationNewMessage(notif) {
        await this._super(notif);
        const channel =
            this.services["mail.store"].threads[createLocalId("mail.channel", notif.payload.id)];
        this.services["mail.chat_window"].insert({ thread: channel });
    },
});

patch(messagingService, "mail/web", {
    dependencies: [...messagingService.dependencies, "mail.chat_window"],
});
