/** @odoo-module **/

import { formatFloat } from "@web/core/l10n/numbers";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

/**
 * @typedef FloatFieldPropsOptions
 * @property {[number, number]} [digits]
 */

/**
 * @typedef FloatFieldPropsAttrs
 * @property {string} [placeholder]
 */

/**
 * @typedef FloatFieldProps
 * @property {string | false} value
 * @property {boolean} isEditing
 * @property {FloatFieldPropsAttrs} attrs
 * @property {FloatFieldPropsOptions} options
 */

export class FloatField extends Component {
    get precision() {
        return this.props.attrs && this.props.attrs.options && this.props.attrs.options.digits
            ? JSON.parse(this.props.attrs.options.digits)[1]
            : 2;
    }
    get formattedValue() {
        return formatFloat(this.props.value, { precision: this.precision });
    }
}
FloatField.template = "web.FloatField";

FloatField.description = _lt("Decimal");
FloatField.supportedFieldTypes = ["float"];

registry.category("fields").add("float", FloatField);
