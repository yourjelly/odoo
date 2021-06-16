/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class EmailField extends Component {}
EmailField.template = "web.EmailField";

EmailField.description = _lt("Email");
EmailField.supportedFieldTypes = ["char"];

registry.category("fields").add("email", EmailField);
