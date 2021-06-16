/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ProgressBarField extends Component {}
ProgressBarField.template = "web.ProgressBarField";

registry.category("fields").add("progressbar", ProgressBarField);
