/* @odoo-module */

import { Component } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";

import { useMessaging, useStore } from "@mail/core/messaging_hook";
import { url } from "@web/core/utils/urls";

export class MessageInReply extends Component {
    static props = ["message", "alignedRight", "onClick"];
    static template = "mail.MessageInReply";

    setup() {
        this.user = useService("user");
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.store": useStore(),
            /** @type {import('@mail/core/thread_service').ThreadService} */
            "mail.thread": useService("mail.thread"),
        };
    }

    get authorAvatarUrl() {
        if (
            this.message.type === "email" &&
            !["partner", "guest"].includes(this.props.message.author.type)
        ) {
            return url("/mail/static/src/img/email_icon.png");
        }
        return this.services["mail.thread"].avatarUrl(
            this.message.author,
            this.props.message.originThread
        );
    }
}
