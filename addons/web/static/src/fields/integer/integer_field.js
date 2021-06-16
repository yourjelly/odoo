/** @odoo-module **/

import { formatFloat } from "@web/core/l10n/numbers";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class IntegerField extends Component {
    get formattedValue() {
        /** @todo should manage virtual ids */
        return formatFloat(this.props.value, { precision: 0 });
    }
}
IntegerField.template = "web.IntegerField";

IntegerField.description = _lt("Integer");
IntegerField.supportedFieldTypes = ["integer"];

registry.category("fields").add("integer", IntegerField);
