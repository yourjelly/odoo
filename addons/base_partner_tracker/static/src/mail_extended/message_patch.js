/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Message } from "@mail/core_ui/message";

patch(Message.prototype, "base_partner_tracker.Message", {
    navigateUser() {
        this.messaging.orm.call('mail.message', 'action_map_navigate', [[this.message.id]])
            .then(action => this.env.services.action.doAction(action))
            .catch(error => this.env.services.notification.add(error.message, { type: 'danger' }));
    },
});
