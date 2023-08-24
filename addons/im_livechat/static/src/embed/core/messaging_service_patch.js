/* @odoo-module */

import { Messaging } from "@mail/core/common/messaging_service";

import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";
import { SESSION_STATE } from "@im_livechat/embed/core/livechat_service";
import { _t } from "@web/core/l10n/translation";

patch(Messaging.prototype, {
    async initialize() {
        await this.env.services["im_livechat.livechat"].initializedDeferred;
        if (this.env.services["im_livechat.livechat"].state === SESSION_STATE.PERSISTED) {
            try {
                await super.initialize();
            } catch (e) {
                this.env.services["im_livechat.livechat"].leaveSession({ notifyServer: false });
                this.env.services["notification"].add(
                    _t("Session expired... Please refresh and try again.")
                );
                throw e;
            }
            return;
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
