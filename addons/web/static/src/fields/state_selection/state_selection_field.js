/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class StateSelectionField extends Component {}
StateSelectionField.template = "web.StateSelectionField";

registry.category("fields").add("state_selection", StateSelectionField);
