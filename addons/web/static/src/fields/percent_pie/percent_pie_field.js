/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class PercentPieField extends Component {}
PercentPieField.template = "web.PercentPieField";

registry.category("fields").add("percentpie", PercentPieField);
