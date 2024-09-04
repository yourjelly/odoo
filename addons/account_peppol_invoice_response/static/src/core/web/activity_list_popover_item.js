/* @odoo-module */

import { ActivityListPopoverItem } from "@mail/core/web/activity_list_popover_item"
import { patch } from "@web/core/utils/patch";

patch(ActivityListPopoverItem.prototype, {
    // setup() {
    //     super.setup(...arguments);
    //     if (!this.pos.isChileanCompany()) {
    //            return;
    //     }
    //     this.intFields.push("l10n_latam_identification_type_id");
    //     this.changes.l10n_cl_sii_taxpayer_type =
    //         this.props.partner.l10n_cl_sii_taxpayer_type || "1";
    //     this.changes.l10n_latam_identification_type_id =
    //         this.props.partner.l10n_latam_identification_type_id &&
    //         this.props.partner.l10n_latam_identification_type_id[0];
    //     this.changes.l10n_cl_dte_email = this.props.partner.l10n_cl_dte_email || "";
    //     this.changes.l10n_cl_activity_description =
    //         this.props.partner.l10n_cl_activity_description || "";
    // },
    get hasPeppolSend() {
        const activity = this.props.activity;
        return activity.state !== "done" && activity.activity_category === "peppol_invoice_response";
    }
});
