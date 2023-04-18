/** @odoo-module **/

import { Component } from "@odoo/owl";
import { AnimatedNumber } from "./animated_number";

export class ColumnProgress extends Component {
    static components = {
        AnimatedNumber,
    };
    static template = "web.ColumnProgress";
    static props = {
        aggregate: { type: Object },
        progressBars: { type: Array },
        progressValue: { type: Object },
        count: { type: Number },
        filterProgressValue: { type: Function },
        onBarClicked: { type: Function, optional: true },
    };
    static defaultProps = {
        onBarClicked: () => {},
    };

    async onBarClick(progressBar) {
        await this.props.filterProgressValue(progressBar.value);
        this.props.onBarClicked();
    }
}
