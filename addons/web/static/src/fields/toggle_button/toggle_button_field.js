/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class ToggleButtonField extends Component {}
ToggleButtonField.template = "web.ToggleButtonField";

ToggleButtonField.description = _lt("Button");
ToggleButtonField.supportedFieldTypes = ["boolean"];

registry.category("fields").add("toggle_button", ToggleButtonField);
