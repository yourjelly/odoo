/* @odoo-module */

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CallInvitation extends Component {
    static props = ["thread"];
    static template = "mail.CallInvitation";

    setup() {
        this.services = {
            "mail.thread": useService("mail.thread"),
            "mail.rtc": useService("mail.rtc"),
        };
    }

    async onClickAccept(ev) {
        this.services["mail.thread"].open(this.props.thread);
        if (this.services["mail.rtc"].state.hasPendingRequest) {
            return;
        }
        await this.services["mail.rtc"].toggleCall(this.props.thread);
    }

    onClickAvatar(ev) {
        this.services["mail.thread"].open(this.props.thread);
    }

    onClickRefuse(ev) {
        if (this.services["mail.rtc"].state.hasPendingRequest) {
            return;
        }
        this.services["mail.rtc"].leaveCall(this.props.thread);
    }
}
