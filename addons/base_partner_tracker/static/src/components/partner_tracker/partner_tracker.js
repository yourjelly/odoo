/** @odoo-module **/
/*global L*/

import { renderToString } from "@web/core/utils/render";
import { registry } from "@web/core/registry";

const { Component, onMounted, onWillUnmount } = owl;

export class PartnerTracker extends Component {
    setup() {
        this.messaging = this.env.services["mail.messaging"];
        this.markers = {};

        onMounted(() => {
            this.env.services['bus_service'].addEventListener('notification', this._onNotification.bind(this));
            this.map = L.map('o_Partner_tracker_map', {
                center: [20, 70],
                zoom: 5
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
            L.Control.geocoder().addTo(this.map);
        });

        onWillUnmount(() => {
            this.env.services['bus_service'].removeEventListener('notification', this._onNotification.bind(this));
        });
    }

    _createPopup(latitude, longitude, partnerId, partnerName) {
        const popup = L.popup({ offset: [0, -30] })
            .setLatLng([latitude, longitude])
            .setContent(renderToString("base_partner_tracker.MarkerPopup", {
                partnerId,
                partnerName,
            }))
            .openOn(this.map);
        const openChatBtn = popup.getElement().querySelector(".o_open_chat");
        if (openChatBtn) {
            openChatBtn.onclick = () => {
                this.messaging.threadService.openChat({ partnerId });
            }
        }
    }

    _onNotification({ detail: notifications }) {
        for (const notification of notifications) {
            if(notification.type === 'update_tracker'){
                const { latitude, longitude, partner_id, partner_name } = {
                    ...notification.payload.coords,
                    ...notification.payload,
                };
                if (partner_id === this.messaging.orm.user.partnerId) {
                    continue;
                }
                const oldMarker = this.markers[partner_id];
                if (oldMarker && oldMarker.marker) {
                    this.map.removeLayer(oldMarker.marker);
                }
                const newMarker = this._create_marker(latitude, longitude, partner_id, partner_name);
                newMarker.addTo(this.map);
                this.markers[partner_id] = { marker: newMarker };
            }
        }
    }

    _create_marker(latitude, longitude, partner_id, partner_name) {
        return L.marker([latitude, longitude]).on("click", () => {
            this._createPopup(latitude, longitude, partner_id, partner_name);
        });
    }
}

PartnerTracker.template = "base_partner_tracker.PartnerTracker";

registry.category("actions").add("partner_tracker", PartnerTracker);
