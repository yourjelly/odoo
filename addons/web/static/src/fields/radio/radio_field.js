/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class RadioField extends Component {}
RadioField.template = "web.RadioField";

registry.category("fields").add("radio", RadioField);
