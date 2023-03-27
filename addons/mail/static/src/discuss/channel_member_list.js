/* @odoo-module */

import { Component, onWillUpdateProps, onWillStart } from "@odoo/owl";
import { useMessaging, useStore } from "@mail/core/messaging_hook";
import { ImStatus } from "./im_status";
import { useService } from "@web/core/utils/hooks";

export class ChannelMemberList extends Component {
    static components = { ImStatus };
    static props = ["thread", "className"];
    static template = "mail.ChannelMemberList";

    setup() {
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.store": useStore(),
            /** @type {import("@mail/core/channel_member_service").ChannelMemberService} */
            "mail.channel.member": useService("mail.channel.member"),
            /** @type {import("@mail/core/thread_service").ThreadService} */
            "mail.thread": useService("mail.thread"),
        };
        onWillStart(() => this.services["mail.channel.member"].fetchMembers(this.props.thread));
        onWillUpdateProps((nextProps) => {
            if (nextProps.thread.channelMembers.length === 0) {
                this.services["mail.channel.member"].fetchMembers(nextProps.thread);
            }
        });
    }

    canOpenChatWith(member) {
        if (this.services["mail.store"].inPublicPage) {
            return false;
        }
        if (member.persona === this.services["mail.store"].self) {
            return false;
        }
        if (member.persona.type === "guest") {
            return false;
        }
        return true;
    }

    openChatAvatar(member) {
        if (!this.canOpenChatWith(member)) {
            return;
        }
        this.services["mail.thread"].openChat({ partnerId: member.persona.id });
    }
}
