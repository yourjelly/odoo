/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class DateTimeField extends Component {}
DateTimeField.template = "web.DateTimeField";

DateTimeField.description = _lt("Date & Time");
DateTimeField.supportedFieldTypes = ["datetime"];

registry.category("fields").add("datetime", DateTimeField);
