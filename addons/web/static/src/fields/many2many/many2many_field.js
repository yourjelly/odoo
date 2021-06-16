/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2ManyField extends Component {}
Many2ManyField.template = "web.Many2ManyField";

registry.category("fields").add("many2many", Many2ManyField);
