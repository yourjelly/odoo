/** @odoo-module */

import { removeFromArrayWithPredicate } from "@mail/utils/arrays";
import { registry } from "@web/core/registry";

export class MessageStarService {
    constructor(env, services) {
        this.env = env;
        this.orm = services.orm;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
        };
        this.env.bus.addEventListener(
            "mail.messaging/notification",
            ({ detail: { notification } }) => {
                switch (notification.type) {
                    case "mail.message/toggle_star": {
                        const { message_ids: messageIds, starred } = notification.payload;
                        for (const messageId of messageIds) {
                            const message = this.services["mail.message"].insert({ id: messageId });
                            this.updateStarred(message, starred);
                            this.services["mail.message"].sortMessages(
                                this.services["mail.store"].discuss.starred
                            );
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        );
    }

    async toggleStar(message) {
        await this.orm.silent.call("mail.message", "toggle_message_starred", [[message.id]]);
    }

    async unstarAll() {
        // apply the change immediately for faster feedback
        this.services["mail.store"].discuss.starred.counter = 0;
        this.services["mail.store"].discuss.starred.messages = [];
        await this.orm.call("mail.message", "unstar_all");
    }

    updateStarred(message, isStarred) {
        message.isStarred = isStarred;
        if (isStarred) {
            this.services["mail.store"].discuss.starred.counter++;
            if (this.services["mail.store"].discuss.starred.messages.length > 0) {
                this.services["mail.store"].discuss.starred.messages.push(message);
            }
        } else {
            this.services["mail.store"].discuss.starred.counter--;
            removeFromArrayWithPredicate(
                this.services["mail.store"].discuss.starred.messages,
                ({ id }) => id === message.id
            );
        }
    }
}

export const messageStarService = {
    dependencies: ["mail.store", "orm"],
    start(env, services) {
        return new MessageStarService(env, services);
    },
};

registry.category("services").add("mail.message.start", messageStarService);
