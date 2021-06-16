/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2OneReferenceField extends Component {}
Many2OneReferenceField.template = "web.Many2OneReferenceField";

registry.category("fields").add("many2one_reference", Many2OneReferenceField);
