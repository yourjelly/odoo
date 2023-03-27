/* @odoo-module */

import { Component } from "@odoo/owl";
import { useRtc } from "@mail/rtc/rtc_hook";
import { isMobileOS } from "@web/core/browser/feature_detection";

export class CallActionList extends Component {
    static props = ["thread", "fullscreen", "compact?"];
    static template = "mail.CallActionList";

    setup() {
        this.services = {
            "mail.rtc": useRtc(),
        };
    }

    get isOfActiveCall() {
        return Boolean(this.props.thread.id === this.services["mail.rtc"].state?.channel?.id);
    }

    get isSmall() {
        return Boolean(this.props.compact && !this.props.fullscreen.isActive);
    }

    get isMobileOS() {
        return isMobileOS();
    }

    /**
     * @param {MouseEvent} ev
     */
    async onClickDeafen(ev) {
        if (this.services["mail.rtc"].state.selfSession.isDeaf) {
            this.services["mail.rtc"].undeafen();
        } else {
            this.services["mail.rtc"].deafen();
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    onClickMicrophone(ev) {
        if (this.services["mail.rtc"].state.selfSession.isMute) {
            if (this.services["mail.rtc"].state.selfSession.isSelfMuted) {
                this.services["mail.rtc"].unmute();
            }
            if (this.services["mail.rtc"].state.selfSession.isDeaf) {
                this.services["mail.rtc"].undeafen();
            }
        } else {
            this.services["mail.rtc"].mute();
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    async onClickRejectCall(ev) {
        if (this.services["mail.rtc"].state.hasPendingRequest) {
            return;
        }
        await this.services["mail.rtc"].leaveCall(this.props.thread);
    }

    /**
     * @param {MouseEvent} ev
     */
    async onClickToggleAudioCall(ev) {
        await this.services["mail.rtc"].toggleCall(this.props.thread);
    }
}
