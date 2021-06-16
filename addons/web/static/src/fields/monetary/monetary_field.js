/** @odoo-module **/

import { formatCurrency } from "@web/core/l10n/currency";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class MonetaryField extends Component {
    get formattedValue() {
        return formatCurrency(this.props.value, "EUR", { digits: [16, 2] });
    }
}
MonetaryField.template = "web.MonetaryField";

MonetaryField.description = _lt("Monetary");
MonetaryField.supportedFieldTypes = ["float", "monetary"];

registry.category("fields").add("monetary", MonetaryField);
