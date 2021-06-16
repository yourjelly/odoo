/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class PhoneField extends Component {}
PhoneField.template = "web.PhoneField";

PhoneField.description = _lt("Phone");
PhoneField.supportedFieldTypes = ["char"];

registry.category("fields").add("phone", PhoneField);
