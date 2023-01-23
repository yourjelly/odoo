/** @odoo-module */

import { registry } from "@web/core/registry";
import { session } from "@web/session";
import { Component } from "@odoo/owl";

const LINK_REGEX = new RegExp("^https?://");

export class DocumentsLink extends Component {

    get url() {
        if (LINK_REGEX.test(this.props.documentation)) {
            return this.props.documentation;
        } else {
            const serverVersion = session.info.server_version.includes("alpha")
                    ? "master"
                    : odoo.info.server_version.slice(0,4);
            return "https://www.odoo.com/documentation/" + serverVersion + this.props.documentation
        }
    }
}

DocumentsLink.template = "web.DocumentsLink";
DocumentsLink.props = {
    documentation: "",
};
DocumentsLink.extractProps = ({ attrs }) => {
    return {
        documentation: attrs.documentation,
    };
};

registry.category("view_widgets").add("documentation_link", DocumentsLink);
