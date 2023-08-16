/* @odoo-module */

import { Messaging } from "@mail/core/common/messaging_service";

import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";
import { SESSION_STATE } from "@im_livechat/embed/core/livechat_service";

patch(Messaging.prototype, {
    initialize() {
        if (this.env.services["im_livechat.livechat"].state === SESSION_STATE.PERSISTED) {
            return super.initialize();
        }
        if (session.livechatData?.options.current_partner_id) {
            this.store.user = this.personaService.insert({
                type: "partner",
                id: session.livechatData.options.current_partner_id,
            });
        }
        this.store.isMessagingReady = true;
        this.isReady.resolve({
            channels: [],
            current_user_settings: {},
        });
    },
});
