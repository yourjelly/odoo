/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ControlPanel } from "@web/search/control_panel/control_panel";

export class MrpDisplayControlPanel extends ControlPanel {
    static template = "mrp.MrpDisplayControlPanel";
}

export class ControlPanelButtons extends Component {
    static template = "mrp.ControlPanelButtons";

    get workcenterButtons() {
        const countByWorkcenter = this.props.workorders.reduce((workcenterButtons, workorder) => {
            const id = workorder.data.workcenter_id[0];
            if (workcenterButtons[id]) {
                workcenterButtons[id].count++;
            } else {
                const name = workorder.data.workcenter_id[1];
                workcenterButtons[id] = {
                    count: 1,
                    name: name,
                };
            }
            return workcenterButtons;
        }, {});
        return Object.entries(countByWorkcenter);
    }
}
