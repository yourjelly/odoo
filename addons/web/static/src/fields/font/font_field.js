/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class FontField extends Component {}
FontField.template = "web.FontField";

registry.category("fields").add("font", FontField);
