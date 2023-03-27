/** @odoo-module */

import { removeFromArrayWithPredicate } from "@mail/utils/arrays";
import { registry } from "@web/core/registry";
import { Notification } from "./notification_model";
import { NotificationGroup } from "./notification_group_model";

export class MessageNotificationService {
    constructor(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
            /** @type {import("@mail/core/persona_service").PersonaService} */
            "mail.persona": services["mail.persona"],
        };
        this.env.bus.addEventListener("mail.message/updating", ({ detail: { message, data } }) => {
            message.notifications = message.notifications.map((notification) =>
                this.insertNotification({ ...notification, messageId: message.id })
            );
        });
    }

    /**
     * @param {Object} data
     * @returns {Notification}
     */
    insertNotification(data) {
        let notification;
        if (data.id in this.services["mail.store"].notifications) {
            notification = this.services["mail.store"].notifications[data.id];
            this.updateNotification(notification, data);
            return notification;
        }
        notification = new Notification(this.services["mail.store"], data);
        this.updateNotification(notification, data);
        // return reactive version
        return this.services["mail.store"].notifications[data.id];
    }

    updateNotification(notification, data) {
        Object.assign(notification, {
            messageId: data.messageId,
            notification_status: data.notification_status,
            notification_type: data.notification_type,
            failure_type: data.failure_type,
            persona: data.res_partner_id
                ? this.services["mail.persona"].insert({
                      id: data.res_partner_id[0],
                      displayName: data.res_partner_id[1],
                      type: "partner",
                  })
                : undefined,
        });
        if (notification.message.author !== this.services["mail.store"].self) {
            return;
        }
        const thread = notification.message.originThread;
        this.insertNotificationGroups({
            modelName: thread?.modelName,
            resId: thread?.id,
            resModel: thread?.model,
            status: notification.notification_status,
            type: notification.notification_type,
            notifications: [
                [notification.isFailure ? "insert" : "insert-and-unlink", notification],
            ],
        });
    }

    insertNotificationGroups(data) {
        let group = this.services["mail.store"].notificationGroups.find((group) => {
            return (
                group.resModel === data.resModel &&
                group.type === data.type &&
                (group.resModel !== "mail.channel" || group.resIds.has(data.resId))
            );
        });
        if (!group) {
            group = new NotificationGroup(this.services["mail.store"]);
        }
        this.updateNotificationGroup(group, data);
        if (group.notifications.length === 0) {
            removeFromArrayWithPredicate(
                this.services["mail.store"].notificationGroups,
                (gr) => gr.id === group.id
            );
        }
        return group;
    }

    updateNotificationGroup(group, data) {
        Object.assign(group, {
            modelName: data.modelName ?? group.modelName,
            resModel: data.resModel ?? group.resModel,
            type: data.type ?? group.type,
            status: data.status ?? group.status,
        });
        const notifications = data.notifications ?? [];
        const alreadyKnownNotifications = new Set(group.notifications.map(({ id }) => id));
        const notificationIdsToRemove = new Set();
        for (const [commandName, notification] of notifications) {
            if (commandName === "insert" && !alreadyKnownNotifications.has(notification.id)) {
                group.notifications.push(notification);
            } else if (commandName === "insert-and-unlink") {
                notificationIdsToRemove.add(notification.id);
            }
        }
        group.notifications = group.notifications.filter(
            ({ id }) => !notificationIdsToRemove.has(id)
        );
        group.lastMessageId = group.notifications[0]?.message.id;
        for (const notification of group.notifications) {
            if (group.lastMessageId < notification.message.id) {
                group.lastMessageId = notification.message.id;
            }
        }
        group.resIds.add(data.resId);
    }
}

export const messageNotificationService = {
    dependencies: ["rpc", "mail.store", "mail.persona"],
    start(env, services) {
        return new MessageNotificationService(env, services);
    },
};

registry.category("services").add("mail.message.notification", messageNotificationService);
