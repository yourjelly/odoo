/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2ManyTagsField extends Component {}
Many2ManyTagsField.template = "web.Many2ManyTagsField";

registry.category("fields").add("many2many_tags", Many2ManyTagsField);
