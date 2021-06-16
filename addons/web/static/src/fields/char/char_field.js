/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

/**
 * @typedef CharFieldPropsAttrs
 * @property {string} [autocomplete]
 * @property {string} [password]
 * @property {string} [placeholder]
 */

/**
 * @typedef CharFieldProps
 * @property {string | false} value
 * @property {boolean} isEditing
 * @property {CharFieldPropsAttrs} attrs
 */

export class CharField extends Component {
    get formattedValue() {
        let value = typeof this.props.value === "string" ? this.props.value : "";
        if (this.isPassword) {
            value = "*".repeat(value.length);
        }
        return value;
    }
    get isPassword() {
        return "password" in this.props.attrs;
    }
}
CharField.template = "web.CharField";

CharField.description = _lt("Text");
CharField.supportedFieldTypes = ["char"];

registry.category("fields").add("char", CharField);
