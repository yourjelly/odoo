/* @odoo-module */

import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

export class MessageDeleteDialog extends Component {
    static components = { Dialog };
    static props = ["close", "message", "messageComponent"];
    static template = "mail.MessageDeleteDialog";

    setup() {
        this.services = {
            /** @type {import("@mail/core/message_service").MessageService} */
            "mail.message": useState(useService("mail.message")),
        };
        this.title = _t("Confirmation");
    }

    onClickDelete() {
        this.services["mail.message"].delete(this.props.message);
        this.props.close();
    }
}
