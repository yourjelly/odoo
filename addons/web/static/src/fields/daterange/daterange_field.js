/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class DateRangeField extends Component {}
DateRangeField.template = "web.DateRangeField";

DateRangeField.supportedFieldTypes = ["date", "datetime"];

registry.category("fields").add("daterange", DateRangeField);
