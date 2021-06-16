/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class PriorityField extends Component {
    get currentOptionIndex() {
        return this.props.meta.selection.findIndex((option) => option[0] === this.props.value);
    }
}
PriorityField.template = "web.PriorityField";

PriorityField.description = _lt("Priority");
PriorityField.supportedFieldTypes = ["selection"];

registry.category("fields").add("priority", PriorityField);
