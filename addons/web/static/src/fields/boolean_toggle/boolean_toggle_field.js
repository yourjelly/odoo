/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class BooleanToggleField extends Component {}
BooleanToggleField.template = "web.BooleanToggleField";

BooleanToggleField.description = _lt("Toggle");
BooleanToggleField.supportedFieldTypes = ["boolean"];

registry.category("fields").add("boolean_toggle", BooleanToggleField);
