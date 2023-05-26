/* @odoo-module */

import { LivechatService } from "@im_livechat/new/core/livechat_service";
import { patch } from "@web/core/utils/patch";

patch(LivechatService.prototype, "website_livechat/livechat_service", {
    setup(env, services) {
        this._super(env, services);
        if (this.options?.chat_request_session) {
            this.updateSession(this.options.chat_request_session);
        }
    },
});
