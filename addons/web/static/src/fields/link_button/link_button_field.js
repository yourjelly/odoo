/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class LinkButtonField extends Component {
    onClick() {
        browser.open(this.props.value, "_blank");
    }
}
LinkButtonField.template = "web.LinkButtonField";

registry.category("fields").add("link_button", LinkButtonField);
