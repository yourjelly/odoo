/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { formatMany2one } from "../format";

const { Component } = owl;

/**
 * @typedef FieldMeta
 * @property {string} type
 */
/**
 * @typedef SelectionFieldMeta
 * @property {"selection"} type
 * @property {[string, string][]} selection
 */

/**
 * @typedef BadgeFieldPropsOptions
 * @property {[number, number]} [digits]
 */

/**
 * @typedef BadgeFieldPropsAttrs
 * @property {string} [placeholder]
 */

/**
 * @typedef BadgeFieldProps
 * @property {string | [number, string] | false} value
 * @property {boolean} isEditing
 * @property {BadgeFieldPropsAttrs} attrs
 * @property {BadgeFieldPropsOptions} options
 * @property {FieldMeta | SelectionFieldMeta} meta
 */

export class BadgeField extends Component {
    get formattedValue() {
        switch (this.props.meta.type) {
            case "many2one":
                return formatMany2one(this.props.value);
            case "selection":
                return this.props.meta.selection.find(
                    (option) => option[0] === this.props.value
                )[1];
            default:
                return typeof this.props.value === "string" ? this.props.value : "";
        }
    }
}
BadgeField.template = "web.BadgeField";

BadgeField.description = _lt("Badge");
BadgeField.supportedFieldTypes = ["char", "many2one", "selection"];

registry.category("fields").add("badge", BadgeField);
