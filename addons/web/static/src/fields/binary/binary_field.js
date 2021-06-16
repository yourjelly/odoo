/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class BinaryField extends Component {}
BinaryField.template = "web.BinaryField";

registry.category("fields").add("binary", BinaryField);
