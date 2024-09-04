/** @odoo-module */

import { ActivityService } from "@mail/core/web/activity_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

function peppolInvoiceResponseDefaults(activity) {
    activity
}

patch(ActivityService.prototype, {
    async acceptPeppolInvoiceResponse(activityId) {
        const activity = this.store.Activity.get(activityId);
        const attachment = await this.orm.call(
            "account.move",
            "action_peppol_invoice_response_accept",
            [[activity.res_id]],
        )
        await this.orm.call("mail.activity", "action_feedback", [[activity.id]], {
            // attachment_ids: attachment.id,
        });
        this.broadcastChannel?.postMessage({
            type: "RELOAD_CHATTER",
            payload: { id: activity.res_id, model: activity.res_model },
        });
    },
    async cancelPeppolInvoiceResponse(activityId) {
        const activity = this.store.Activity.get(activityId);
        return new Promise((resolve) =>
            this.env.services.action.doAction(
                {
                    type: "ir.actions.act_window",
                    name: _t("Peppol Invoice Response"),
                    res_model: "account_peppol.invoice_response",
                    view_mode: "form",
                    views: [[false, "form"]],
                    target: "new",
                    // res_id: activityId,
                    context: {
                        // default_res_model: activity.res_model,
                        // default_res_id: activity.res_id,
                        default_direction: "outgoing",
                        default_move_id: activity.res_id,
                        default_code: 'RE',
                    },
                },
                { onClose: resolve }
            )
        );
    },
});
