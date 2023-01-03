/* @odoo-module */

import { Messaging, asyncMethods } from "./messaging";
import { createLocalId } from "./thread_model.create_local_id";

export const messagingService = {
    dependencies: [
        "mail.state",
        "rpc",
        "orm",
        "user",
        "router",
        "bus_service",
        "im_status",
        "notification",
        "multi_tab",
        "presence",
        "mail.soundEffects",
        "mail.userSettings",
        "mail.chat_window",
        "mail.thread",
        "mail.message",
    ],
    async: asyncMethods,
    start(
        env,
        {
            "mail.state": state,
            rpc,
            orm,
            user,
            router,
            bus_service: bus,
            im_status,
            notification,
            multi_tab: multiTab,
            presence,
            "mail.soundEffects": soundEffects,
            "mail.userSettings": userSettings,
            "mail.chat_window": chatWindow,
            "mail.thread": thread,
            "mail.message": message,
        }
    ) {
        // compute initial discuss thread
        let threadLocalId = createLocalId("mail.box", "inbox");
        const activeId = router.current.hash.active_id;
        if (typeof activeId === "string" && activeId.startsWith("mail.box_")) {
            threadLocalId = createLocalId("mail.box", activeId.slice(9));
        }
        if (typeof activeId === "string" && activeId.startsWith("mail.channel_")) {
            threadLocalId = createLocalId("mail.channel", parseInt(activeId.slice(13), 10));
        }

        const messaging = new Messaging(
            env,
            state,
            rpc,
            orm,
            user,
            router,
            bus,
            threadLocalId,
            im_status,
            notification,
            multiTab,
            presence,
            soundEffects,
            userSettings,
            chatWindow,
            thread,
            message
        );
        messaging.initialize();
        bus.addEventListener("notification", (notifEvent) => {
            messaging.handleNotification(notifEvent.detail);
        });
        bus.start();
        // debugging. remove this
        window.messaging = messaging;
        return messaging;
    },
};
