/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class PercentageField extends Component {}
PercentageField.template = "web.PercentageField";

PercentageField.description = _lt("Percentage");
PercentageField.supportedFieldTypes = ["float"];

registry.category("fields").add("percentage", PercentageField);
