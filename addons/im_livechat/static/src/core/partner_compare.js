/* @odoo-module */

import { partnerCompareRegistry } from "@mail/core/common/partner_compare";

partnerCompareRegistry.add(
    "im_livechat.active",
    (p1, p2, { thread }) => {
        if (thread.type === "livechat" && (p1.is_available || p2.is_available)) {
            return p1.is_available ? -1 : 1;
        }
    },
    { sequence: -10 }
);

partnerCompareRegistry.add(
    "im_livechat.invite-count",
    (p1, p2, { thread }) => {
        if (thread.type === "livechat" && (p1.invite_count > 0 || p2.invite_count > 0)) {
            return p2.invite_count - p1.invite_count;
        }
    },
    { sequence: -5 }
);
