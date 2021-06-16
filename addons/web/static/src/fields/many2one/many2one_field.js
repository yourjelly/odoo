/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2OneField extends Component {}
Many2OneField.template = "web.Many2OneField";

registry.category("fields").add("many2one", Many2OneField);
