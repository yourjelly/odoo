import { loadBundle } from "@web/core/assets";
import { _t } from "@web/core/l10n/translation";
import { memoize } from "@web/core/utils/functions";
import { RemoteConnectionError, RemoteInterface, dispatchEvent } from "./remoteHelpers";

/**
 * @return {Promise<{ SfuClient: import("@mail/static/libs/discuss_sfu/discuss_sfu").SfuClient, SFU_CLIENT_STATE: import("@mail/static/libs/discuss_sfu/discuss_sfu").SFU_CLIENT_STATE }>}
 */
const loadSfuAssets = memoize(async () => await loadBundle("mail.assets_odoo_sfu"));

const TO_ALL = -1;

export class RemoteSFU extends RemoteInterface {
    async start() {
        try {
            await loadSfuAssets();
            const sfuModule = odoo.loader.modules.get("@mail/../lib/odoo_sfu/odoo_sfu");
            this.SFU_CLIENT_STATE = sfuModule.SFU_CLIENT_STATE;
            this.sfuClient = new sfuModule.SfuClient();
            this.sfuClient.addEventListener("update", this.handleSfuClientUpdates.bind(this));
            this.sfuClient.addEventListener(
                "stateChange",
                this.handleSfuClientStateChange.bind(this)
            );
            this.sfuClient.connect(this.config.sfuConfig.url, this.config.sfuConfig.json_web_token);
        } catch (e) {
            const message = _t("Failed to load the SFU server, falling back to peer-to-peer");
            throw new RemoteConnectionError(message, e);
        }
    }
    stop() {
        this.sfuClient.disconnect();
    }
    /**
     * @param {String} notificationName
     * @param {any} notificationPayload
     */
    notifyAllPeers(notificationName, notificationPayload) {
        // The sfuClient might not have started, especially since the assets
        // need to be loaded asynchronously.
        if (!this.sfuClient) {
            return;
        }
        const transportPayload = {
            toPeerId: TO_ALL,
            notificationName,
            notificationPayload,
        };
        this.sfuClient.broadcast(JSON.stringify(transportPayload));
    }
    /**
     * @param {String} peerId
     * @param {String} notificationName
     * @param {any} notificationPayload
     */
    notifyPeer(peerId, notificationName, notificationPayload) {
        if (!this.sfuClient) {
            return;
        }
        const transportPayload = {
            toPeerId: peerId,
            notificationName,
            notificationPayload,
        };
        this.sfuClient.broadcast(JSON.stringify(transportPayload));
    }
    /**
     * @param {CustomEvent} param
     * @param {Object} param.detail
     * @param {String} param.detail.name
     * @param {any} param.detail.payload
     */
    async handleSfuClientUpdates({ detail }) {
        const { name, payload } = detail;
        switch (name) {
            case "disconnect": {
                const fromPeerId = payload.sessionId.split(":")[1];
                dispatchEvent(this, "remote-notification", {
                    fromPeerId,
                    notificationName: "remove_peer",
                });

                break;
            }
            case "broadcast": {
                const fromPeerId = payload.senderId.split(":")[1];
                const transportPayload = JSON.parse(payload.message);
                const { toPeerId, notificationName, notificationPayload } = transportPayload;

                if (this.config.peerId !== toPeerId && toPeerId !== TO_ALL) {
                    return;
                }
                dispatchEvent(this, "remote-notification", {
                    fromPeerId,
                    notificationName,
                    notificationPayload,
                });
                break;
            }
        }
    }
    async handleSfuClientStateChange({ detail: { state, cause } }) {
        switch (state) {
            case this.SFU_CLIENT_STATE.AUTHENTICATED:
                dispatchEvent(this, "sfu-connected");
                break;
            case this.SFU_CLIENT_STATE.CLOSED:
                {
                    let text;
                    if (cause === "full") {
                        text = _t("Channel full");
                    } else {
                        text = _t("Connection to SFU server closed by the server");
                    }
                    this.notification.add(text, {
                        type: "warning",
                    });
                }
                return;
        }
    }
}
