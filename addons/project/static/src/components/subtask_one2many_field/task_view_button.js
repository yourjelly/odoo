/** @odoo-module */

import { ViewButton } from "@web/views/view_button/view_button";
import { useService } from "@web/core/utils/hooks";

export class TaskViewButton extends ViewButton {
    setup() {
        this.action = useService("action");
    }
    async onClick(ev) {
        if (this.props.clickParams.name != "action_open_task") {
            super.onClick(ev);
        } else {
            const record = this.props.record;
            await record.save({ no_reload: true });
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: record.resModel,
                res_id: record.data.id,
                views: [[false, "form"]],
                context: record.context,
            });
        }
    }
}

TaskViewButton.props = [...ViewButton.props];
