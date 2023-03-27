/** @odoo-module */

import { Messaging } from "@mail/core/messaging_service";
import { patch } from "@web/core/utils/patch";

patch(Messaging.prototype, "website_livechat", {
    handleNotification(notifications) {
        this._super(notifications);
        for (const notification of notifications) {
            if (notification.type === "website_livechat.send_chat_request") {
                const channel = this.services["mail.thread"].insert({
                    ...notification.payload,
                    id: notification.payload.id,
                    model: "mail.channel",
                    serverData: notification.payload,
                    type: notification.payload.channel.channel_type,
                });
                const chatWindow = this.services["mail.chat_window"].insert({ thread: channel });
                this.services["mail.chat_window"].makeVisible(chatWindow);
                this.services["mail.chat_window"].focus(chatWindow);
            }
        }
    },
});
