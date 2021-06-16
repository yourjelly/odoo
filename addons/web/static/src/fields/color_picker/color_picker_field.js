/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ColorPickerField extends Component {}
ColorPickerField.template = "web.ColorPickerField";

registry.category("fields").add("color_picker", ColorPickerField);
