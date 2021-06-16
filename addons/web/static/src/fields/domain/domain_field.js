/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class DomainField extends Component {}
DomainField.template = "web.DomainField";

registry.category("fields").add("domain", DomainField);
