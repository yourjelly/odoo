/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ControlPanel } from "@web/search/control_panel/control_panel";

export class MrpDisplayControlPanel extends ControlPanel {
    static template = "mrp.MrpDisplayControlPanel";
}

export class ControlPanelButtons extends Component {
    static template = "mrp.ControlPanelButtons";
    static props = {
        activeWorkcenter: [Boolean, Number],
        selectWorkcenter: Function,
        workorders: Array,
    };

    get workcenterButtons() {
        const countByWorkcenter = this.props.workorders.reduce((workcenterButtons, workorder) => {
            const [id, name] = workorder.data.workcenter_id;
            if (workcenterButtons[id]) {
                workcenterButtons[id].count++;
            } else {
                workcenterButtons[id] = { count: 1, name };
            }
            return workcenterButtons;
        }, {});
        return Object.entries(countByWorkcenter);
    }
}
