/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class StatusBarField extends Component {}
StatusBarField.template = "web.StatusBarField";

registry.category("fields").add("statusbar", StatusBarField);
