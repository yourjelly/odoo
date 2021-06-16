/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2ManyTagsAvatarField extends Component {}
Many2ManyTagsAvatarField.template = "web.Many2ManyTagsAvatarField";

registry.category("fields").add("many2many_tags_avatar", Many2ManyTagsAvatarField);
