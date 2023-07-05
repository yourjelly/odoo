/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { useDebounced } from "@web/core/utils/timing";

export class BreakInOut extends Component {
    setup() {
        this.actionService = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.onClickBreakInOut = useDebounced(this.breakInOut, 200, true);
    }

    async breakInOut() {
        const result = await this.orm.call("hr.employee", "break_manual", [
            [this.props.employeeId],
            this.props.nextAction,
        ]);
        if (result.action) {
            this.actionService.doAction(result.action);
        } else if (result.warning) {
            this.notification.add(result.warning, { type: "danger" });
        }
    }
}

BreakInOut.template = "hr_attendance.BreakInOut";
BreakInOut.props = {
    breakIn: Boolean,
    employeeId: Number,
    nextAction: String,
};
