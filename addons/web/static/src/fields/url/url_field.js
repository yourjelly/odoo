/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

const { Component } = owl;

export class UrlField extends Component {
    get href() {
        let href = this.props.value;
        if (this.props.value && !this.props.attrs.options.websitePath) {
            const regex = /^((ftp|http)s?:\/)?\//i; // http(s)://... ftp(s)://... /...
            href = !regex.test(this.props.value) ? `http://${href}` : href;
        }
        return href;
    }
}
UrlField.template = "web.UrlField";

UrlField.description = _lt("URL");
UrlField.supportedFieldTypes = ["char"];

registry.category("fields").add("url", UrlField);
