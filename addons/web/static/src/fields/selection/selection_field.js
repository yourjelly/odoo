/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class SelectionField extends Component {
    get formattedValue() {
        return this.props.meta.selection.find((option) => option[0] === this.props.value)[1];
    }
}
SelectionField.template = "web.SelectionField";

SelectionField.description = _lt("Selection");
SelectionField.supportedFieldTypes = ["selection"];

registry.category("fields").add("selection", SelectionField);
