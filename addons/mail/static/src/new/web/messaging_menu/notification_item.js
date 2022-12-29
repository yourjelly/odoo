/* @odoo-module */

import { Component, useRef } from "@odoo/owl";
import { ImStatus } from "@mail/new/discuss/im_status";
import { RelativeTime } from "@mail/new/core_ui/relative_time";

export class NotificationItem extends Component {
    static components = { RelativeTime, ImStatus };
    static props = [
        "body?",
        "count?",
        "datetime?",
        "displayName",
        "hasMarkAsReadButton?",
        "iconSrc",
        "isLast",
        "onClick",
        "slots?",
    ];
    static template = "mail.notification_item";

    setup() {
        this.markAsReadRef = useRef("markAsRead");
    }

    onClick(ev) {
        this.props.onClick(ev.target === this.markAsReadRef.el);
    }
}
