/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MessageService } from "@mail/core/message_service";
import { assignDefined } from "@mail/utils/misc";

patch(MessageService.prototype, "base_partner_tracker.MessageService", {
    update(message, data) {
        const {
            partner_latitude: partnerLatitude = message.partnerLatitude,
            partner_longitude: partnerLongitude = message.partnerLongitude,
        } = data;

        assignDefined(message, {
            partnerLatitude,
            partnerLongitude,
        });

        this._super(...arguments);
    }

});
