/* @odoo-module */

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { orm } from "@web/core/orm";
import { _t } from "@web/core/l10n/translation";

export class SnailmailError extends Component {
    static components = { Dialog };
    static props = ["close", "failureType", "messageId"];
    static template = "snailmail.SnailmailError";

    setup() {
        this.title = _t("Failed letter");
    }

    async fetchSnailmailCreditsUrl() {
        return await orm.call("iap.account", "get_credits_url", ["snailmail"]);
    }

    async fetchSnailmailCreditsUrlTrial() {
        return await orm.call("iap.account", "get_credits_url", ["snailmail", "", 0, true]);
    }

    async onClickResendLetter() {
        await orm.call("mail.message", "send_letter", [[this.props.messageId]]);
        this.props.close();
    }

    async onClickCancelLetter() {
        await orm.call("mail.message", "cancel_letter", [[this.props.messageId]]);
        this.props.close();
    }

    get snailmailCreditsUrl() {
        return this.fetchSnailmailCreditsUrl();
    }

    get snailmailCreditsUrlTrial() {
        return this.fetchSnailmailCreditsUrlTrial();
    }
}
