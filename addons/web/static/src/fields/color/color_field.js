/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ColorField extends Component {}
ColorField.template = "web.ColorField";

registry.category("fields").add("color", ColorField);
