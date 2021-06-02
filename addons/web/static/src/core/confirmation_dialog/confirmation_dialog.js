/** @odoo-module */

import { Dialog } from "../dialog/dialog";
import { _lt } from "../l10n/translation";

export class ConfirmationDialog extends Dialog {
    setup() {
        super.setup();
        this.title = this.props.title;
    }
    _cancel() {
        if (this.props.cancel) {
            this.props.cancel();
        }
        this.close();
    }

    _confirm() {
        if (this.props.confirm) {
            this.props.confirm();
        }
        this.close();
    }
}
ConfirmationDialog.props = {
    title: {
        validate: (m) => {
            return (
                typeof m === "string" || (typeof m === "object" && typeof m.toString === "function")
            );
        },
    },
    body: String,
    confirm: { type: Function, optional: true },
    contentClass: { type: String, optional: true },
    cancel: { type: Function, optional: true },
};

ConfirmationDialog.bodyTemplate = "web.ConfirmationDialogBody";
ConfirmationDialog.footerTemplate = "web.ConfirmationDialogFooter";

export class AlertDialog extends ConfirmationDialog {}
AlertDialog.size = "modal-sm";
AlertDialog.defaultProps = {
    title: _lt("Alert"),
};
