/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2OneAvatarField extends Component {}
Many2OneAvatarField.template = "web.Many2OneAvatarField";

registry.category("fields").add("many2one_avatar", Many2OneAvatarField);
