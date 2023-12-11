/** @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";

patch(Thread.prototype, {
    requested_by_operator: false,

    get hasWelcomeMessage() {
        return super.hasWelcomeMessage && !this.requested_by_operator;
    },
});
