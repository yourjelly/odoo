/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ReferenceField extends Component {}
ReferenceField.template = "web.ReferenceField";

registry.category("fields").add("reference", ReferenceField);
