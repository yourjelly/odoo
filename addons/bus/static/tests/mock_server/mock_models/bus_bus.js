/** @odoo-module */

import { WebsocketWorker } from "@bus/workers/websocket_worker";
import { after } from "@odoo/hoot";
import { mockWorker } from "@odoo/hoot-mock";
import { makeNetworkLogger } from "@web/../lib/hoot/core/logger";
import { getServerWebSockets, models, patchWithCleanup } from "@web/../tests/web_test_helpers";
import { registry } from "@web/core/registry";

export class BusBus extends models.Model {
    _name = "bus.bus";

    wsWorker;
    channelsByUser = {};
    lastBusNotificationId = 0;
    /** Notifications waiting for batch dispatching */
    pendingNotifications = [];
    /** All notifications, used to return missed notifications when subscribe is
     * called.
     * */
    allNotifications = [];

    constructor() {
        super(...arguments);
        const restoreWorkers = mockWorker(() => {});
        after(restoreWorkers);
        const self = this;
        patchWithCleanup(WebsocketWorker.prototype, {
            _sendToServer(message) {
                makeNetworkLogger("BUS", message.event_name).logRequest(() => message.data);
                self._performWebsocketRequest(message);
            },
        });
    }

    /**
     * @param {models.Model | string} channel
     * @param {string} notificationType
     * @param {any} message
     */
    _sendone(channel, notificationType, message) {
        this._sendmany([[channel, notificationType, message]]);
    }

    /** @param {[models.Model | string, string, any][]} notifications */
    _sendmany(notifications) {
        /** @type {import("mock_models").IrWebSocket} */
        const IrWebSocket = this.env["ir.websocket"];

        if (!notifications.length) {
            return;
        }
        notifications.map((n) => {
            n.push(++this.lastBusNotificationId);
            return n;
        });
        this.allNotifications.push(...notifications);
        const values = [];
        const authenticatedUserId =
            "res.users" in this.env && this.env.cookie.get("authenticated_user_sid");
        const channels =
            (authenticatedUserId
                ? this.channelsByUser[authenticatedUserId]
                : IrWebSocket._build_bus_channel_list()) ?? [];
        notifications = notifications.filter(([target]) =>
            channels.some((channel) => {
                if (typeof target === "string") {
                    return channel === target;
                }
                if (Array.isArray(channel) !== Array.isArray(target)) {
                    return false;
                }
                if (Array.isArray(channel)) {
                    const { __model: cModel, id: cId } = channel[0];
                    const { __model: tModel, id: tId } = target[0];
                    return cModel === tModel && cId === tId && channel[1] === target[1];
                }
                return channel.__model === target.__model && channel.id === target.id;
            })
        );
        if (notifications.length === 0) {
            return;
        }
        for (const notification of notifications) {
            const [type, payload, id] = notification.slice(1, notification.length);
            values.push({ id, message: { payload, type } });
        }
        this.pendingNotifications.push(...values);
        if (this.pendingNotifications.length) {
            this._planNotificationSending();
        }
    }

    /**
     * Helper to send the pending notifications to the client. This method is
     * push to the micro task queue to simulate server-side batching of
     * notifications.
     */
    _planNotificationSending() {
        queueMicrotask(() => {
            if (this.pendingNotifications.length === 0) {
                return;
            }
            for (const websocket of getServerWebSockets()) {
                websocket.send(JSON.stringify(this.pendingNotifications));
            }
            this.pendingNotifications = [];
        });
    }

    /**
     * Normally part of the websocket class itself on the server, put here for
     * convenience.
     *
     * @param {Object} message Message sent through the websocket to the server.
     * @param {string} [message.event_name]
     * @param {any} [message.data]
     */
    _performWebsocketRequest({ event_name, data }) {
        if (event_name === "update_presence") {
            const { inactivity_period, im_status_ids_by_model } = data;
            this.env["ir.websocket"]._update_presence(inactivity_period, im_status_ids_by_model);
        } else if (event_name === "subscribe") {
            this.channelsByUser[this.env?.uid] = this.env["ir.websocket"]._build_bus_channel_list(
                data.channels
            );
            const missedNotifications = this.allNotifications
                .filter((n) => n[3] > data.last)
                .sort((a, b) => a.id - b.id);
            this._sendmany(missedNotifications);
        }
        const callbackFn = registry
            .category("mock_server_websocket_callbacks")
            .get(event_name, null);
        if (callbackFn) {
            callbackFn(data);
        }
    }
}
