/** @odoo-module */

import { Message } from "@mail/new/core/message_model";
import { patch } from "@web/core/utils/patch";

patch(Message.prototype, "im_livechat", {
    get allowReplies() {
        return this.originThread?.type === "livechat" ? false : this._super();
    },
});
