/** @odoo-module **/

import { formatFloat } from "@web/core/l10n/numbers";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class FloatFactorField extends Component {
    get precision() {
        return this.props.attrs && this.props.attrs.options && this.props.attrs.options.digits
            ? JSON.parse(this.props.attrs.options.digits)[1]
            : 2;
    }
    get factor() {
        return this.props.options.factor || 1;
    }
    get formattedValue() {
        return formatFloat(this.props.value === false ? false : this.props.value * this.factor, {
            precision: this.precision,
        });
    }
}
FloatFactorField.template = "web.FloatFactorField";

FloatFactorField.supportedFieldTypes = ["float"];

registry.category("fields").add("float_factor", FloatFactorField);
