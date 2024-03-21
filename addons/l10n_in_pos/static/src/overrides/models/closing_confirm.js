/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

patch(ClosePosPopup.prototype, {
    async confirm() {
        if (this.pos.company.country_id?.code === "IN" && !this.pos.company.state_id) {
            let msg = _t("Your company " + this.pos.company.name +" needs to have a correct address in order to open the session.\n" + "Set the address of your company (Don't forget the State field)");
            await this.dialog.add(ConfirmationDialog,{
                title: _t("Company address is missing"),
                body: msg,
                confirmLabel: _t("Go to company configuration"),
                confirm: () => {
                    window.location = "/web#id=" + this.pos.company.id + "&action=base.action_res_company_form";
                }
            });
        }
    }
});
