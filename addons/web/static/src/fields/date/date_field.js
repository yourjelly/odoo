/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class DateField extends Component {}
DateField.template = "web.DateField";

DateField.description = _lt("Date");
DateField.supportedFieldTypes = ["date", "datetime"];

registry.category("fields").add("date", DateField);
