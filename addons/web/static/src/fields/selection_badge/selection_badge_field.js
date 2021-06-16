/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class SelectionBadgeField extends Component {}
SelectionBadgeField.template = "web.SelectionBadgeField";

SelectionBadgeField.description = _lt("Badges");
SelectionBadgeField.supportedFieldTypes = ["selection"];

registry.category("fields").add("selection_badge", SelectionBadgeField);
