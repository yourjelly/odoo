/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2ManyCheckBoxesField extends Component {}
Many2ManyCheckBoxesField.template = "web.Many2ManyCheckBoxesField";

registry.category("fields").add("many2many_checkboxes", Many2ManyCheckBoxesField);
