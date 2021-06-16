/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class AceField extends Component {}
AceField.template = "web.AceField";

registry.category("fields").add("ace", AceField);
