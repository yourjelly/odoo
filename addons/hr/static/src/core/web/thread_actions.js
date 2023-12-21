/* @odoo-module */

import { threadActionsRegistry } from "@mail/core/common/thread_actions";
import { _t } from "@web/core/l10n/translation";
import { orm } from "@web/core/orm";
import { useComponent } from "@odoo/owl";

threadActionsRegistry.add("open-hr-profile", {
    condition(component) {
        return (
            component.thread?.type === "chat" &&
            component.props.chatWindow?.isOpen &&
            component.thread.correspondent.employeeId
        );
    },
    icon: "fa fa-fw fa-id-card",
    name: _t("Open Profile"),
    async open(component) {
        component.actionService.doAction({
            type: "ir.actions.act_window",
            res_id: component.thread.correspondent.employeeId,
            res_model: "hr.employee.public",
            views: [[false, "form"]],
        });
    },
    async setup(action) {
        const component = useComponent();
        let employeeId;
        if (!component.thread?.correspondent?.employeeId && component.thread?.correspondent) {
            const employees = await orm.silent.searchRead(
                "hr.employee",
                [["user_partner_id", "=", component.thread.correspondent.id]],
                ["id"]
            );
            employeeId = employees[0]?.id;
            if (employeeId) {
                component.thread.correspondent.employeeId = employeeId;
            }
        }
    },
    sequence: 16,
});
