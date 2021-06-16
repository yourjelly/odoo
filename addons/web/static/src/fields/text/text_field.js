/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class TextField extends Component {}
TextField.template = "web.TextField";

TextField.description = _lt("Multiline Text");
TextField.supportedFieldTypes = ["text", "html"];

registry.category("fields").add("html", TextField);
registry.category("fields").add("text", TextField);
