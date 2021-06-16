/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class FloatTimeField extends Component {
    get formattedValue() {
        let hour = Math.floor(Math.abs(this.props.value));
        let min = Math.round((Math.abs(this.props.value) % 1) * 60);
        if (min === 60) {
            min = 0;
            hour = hour + 1;
        }
        return `${this.props.value < 0 ? "-" : ""}${hour}:${min}`;
    }
}
FloatTimeField.template = "web.FloatTimeField";

FloatTimeField.description = _lt("Time");
FloatTimeField.supportedFieldTypes = ["float"];

registry.category("fields").add("float_time", FloatTimeField);
