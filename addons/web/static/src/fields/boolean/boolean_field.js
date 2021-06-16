/** @odoo-module **/

import { CheckBox } from "@web/core/checkbox/checkbox";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class BooleanField extends Component {}
BooleanField.components = { CheckBox };
BooleanField.template = "web.BooleanField";

BooleanField.description = _lt("Checkbox");
BooleanField.supportedFieldTypes = ["boolean"];

registry.category("fields").add("boolean", BooleanField);
