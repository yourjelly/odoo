/** @odoo-module **/

import { Component } from "@odoo/owl";
import { AnimatedNumber } from "./animated_number";

export class ColumnProgress extends Component {}

ColumnProgress.components = {
    AnimatedNumber,
};
ColumnProgress.template = "web.ColumnProgress";
ColumnProgress.props = {
    aggregate: { type: Object },
    group: { type: Object },
};
