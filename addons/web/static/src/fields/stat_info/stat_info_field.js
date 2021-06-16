/** @odoo-module **/

import { formatFloat } from "@web/core/l10n/numbers";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class StatInfoField extends Component {
    get formattedValue() {
        return formatFloat(this.props.value || 0, {
            precision: this.props.meta.type === "integer" ? 0 : 2,
        });
    }
    get text() {
        // if (!this.props.attrs.nolabel) {
        //     if (this.props.attrs.options.label_field) {
        //     } else {
        //     }
        // }
        return "";
    }
}
StatInfoField.template = "web.StatInfoField";

StatInfoField.supportedFieldTypes = ["integer", "float"];

registry.category("fields").add("statinfo", StatInfoField);
