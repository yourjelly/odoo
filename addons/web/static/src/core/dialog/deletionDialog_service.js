/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { escape } from "@web/core/utils/strings";
import { markup } from "@odoo/owl";
import { registry } from "@web/core/registry";


export const deletionDialog = {
    dependencies: ["dialog"],
    start(env, { dialog }) {
        return {
            async addDeletionDialog(component) {
                    const message = _t("Some of your records will be deleted Are you sure");
                    const confirmationDialogProps = component.deleteConfirmationDialogProps;
                    confirmationDialogProps.title = "Are you sure";
                    confirmationDialogProps.body = markup(`<div class="text-danger">${escape(message)}</div>`);
                    dialog.add(ConfirmationDialog, confirmationDialogProps);
            },
        }
    }
}

registry.category("services").add("deletion_dialog", deletionDialog);
