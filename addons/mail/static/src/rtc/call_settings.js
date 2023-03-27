/* @odoo-module */

import { Component, onWillStart, useExternalListener, useState } from "@odoo/owl";
import { useRtc } from "@mail/rtc/rtc_hook";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";

export class CallSettings extends Component {
    static template = "mail.CallSettings";
    static props = ["thread", "className?"];

    setup() {
        this.services = {
            "mail.user_settings": useState(useService("mail.user_settings")),
            "mail.rtc": useRtc(),
        };
        this.state = useState({
            userDevices: [],
        });
        useExternalListener(browser, "keydown", this._onKeyDown);
        useExternalListener(browser, "keyup", this._onKeyUp);
        onWillStart(async () => {
            this.state.userDevices = await browser.navigator.mediaDevices.enumerateDevices();
        });
    }

    get pushToTalkKeyText() {
        const { shiftKey, ctrlKey, altKey, key } =
            this.services["mail.user_settings"].pushToTalkKeyFormat();
        const f = (k, name) => (k ? name : "");
        return `${f(ctrlKey, "Ctrl + ")}${f(altKey, "Alt + ")}${f(shiftKey, "Shift + ")}${key}`;
    }

    _onKeyDown(ev) {
        if (!this.services["mail.user_settings"].isRegisteringKey) {
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        this.services["mail.user_settings"].setPushToTalkKey(ev);
    }

    _onKeyUp(ev) {
        if (!this.services["mail.user_settings"].isRegisteringKey) {
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        this.services["mail.user_settings"].isRegisteringKey = false;
    }

    onChangeLogRtcCheckbox(ev) {
        this.services["mail.user_settings"].logRtc = ev.target.checked;
    }

    onChangeSelectAudioInput(ev) {
        this.services["mail.user_settings"].setAudioInputDevice(ev.target.value);
    }

    onChangePushToTalk() {
        if (this.services["mail.user_settings"].usePushToTalk) {
            this.services["mail.user_settings"].isRegisteringKey = false;
        }
        this.services["mail.user_settings"].togglePushToTalk();
    }

    onClickDownloadLogs() {
        const data = JSON.stringify(Object.fromEntries(this.services["mail.rtc"].state.logs));
        const blob = new Blob([data], { type: "application/json" });
        const downloadLink = document.createElement("a");
        const channelId = this.services["mail.rtc"].state.logs.get("channelId");
        const sessionId = this.services["mail.rtc"].state.logs.get("selfSessionId");
        const now = luxon.DateTime.now().toFormat("yyyy-ll-dd_HH-mm");
        downloadLink.download = `RtcLogs_Channel_${channelId}_Session_${sessionId}_${now}.json`;
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.click();
        URL.revokeObjectURL(url);
    }

    onClickRegisterKeyButton() {
        this.services["mail.user_settings"].isRegisteringKey =
            !this.services["mail.user_settings"].isRegisteringKey;
    }

    onChangeDelay(ev) {
        this.services["mail.user_settings"].setDelayValue(ev.target.value);
    }

    onChangeThreshold(ev) {
        this.services["mail.user_settings"].setThresholdValue(parseFloat(ev.target.value));
    }

    onChangeBlur(ev) {
        this.services["mail.user_settings"].useBlur = ev.target.checked;
    }

    onChangeVideoFilterCheckbox(ev) {
        const showOnlyVideo = ev.target.checked;
        this.props.thread.showOnlyVideo = showOnlyVideo;
        const activeRtcSession = this.props.thread.activeRtcSession;
        if (showOnlyVideo && activeRtcSession && !activeRtcSession.videoStream) {
            this.props.thread.activeRtcSession = undefined;
        }
    }

    onChangeBackgroundBlurAmount(ev) {
        this.services["mail.user_settings"].backgroundBlurAmount = Number(ev.target.value);
    }

    onChangeEdgeBlurAmount(ev) {
        this.services["mail.user_settings"].edgeBlurAmount = Number(ev.target.value);
    }
}
