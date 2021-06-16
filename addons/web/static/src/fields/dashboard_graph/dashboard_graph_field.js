/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class DashboardGraphField extends Component {}
DashboardGraphField.template = "web.DashboardGraphField";

registry.category("fields").add("dashboard_graph", DashboardGraphField);
