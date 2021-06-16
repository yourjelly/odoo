/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2ManyBinaryField extends Component {}
Many2ManyBinaryField.template = "web.Many2ManyBinaryField";

registry.category("fields").add("many2many_binary", Many2ManyBinaryField);
