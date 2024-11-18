/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";


class CrmTeamFormController extends FormController {

    setup() {
        super.setup();
        this.orm = useService("orm");
    }

    async beforeExecuteActionButton(clickParams) {
        if (clickParams.name === "activate_multi_membership") {
            if (!user.hasGroup("sales_team.group_sale_manager")) {
                return false;
            }
            const alert = document.querySelector(".o_crm_team_member_alert");
            try {
                await this.orm.call("ir.config_parameter", "set_param", [
                    "sales_team.membership_multi",
                    true,
                ]);
                alert?.classList.add('d-none');
            } catch {
                const alertText = alert?.querySelector("div[name='member_warning'] span");
                const activationBtn = alert?.querySelector("button[name='activate_multi_membership']");
                if (alert && alertText && activationBtn) {
                    alert.classList.replace("alert-info", "alert-danger");
                    activationBtn.classList.add("d-none");
                    alertText.textContent = _t("An error occurred while activating the Multi-Team option.");
                }
            }
            return false;
        }
        return super.beforeExecuteActionButton(...arguments);
    }
}
registry.category("views").add("crm_team_form", {
    ...formView,
    Controller: CrmTeamFormController,
});
