/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class LabelSelectionField extends Component {}
LabelSelectionField.template = "web.LabelSelectionField";

registry.category("fields").add("label_selection", LabelSelectionField);
