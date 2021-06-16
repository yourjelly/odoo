/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class FloatToggleField extends Component {}
FloatToggleField.template = "web.FloatToggleField";

FloatToggleField.supportedFieldTypes = ["float"];

registry.category("fields").add("float_toggle", FloatToggleField);
