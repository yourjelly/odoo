import { Component, xml } from "@odoo/owl";

import { ResourcePage } from "@t9n/core/resource_page";
import { registry } from "@web/core/registry";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

export class OpenResourcePage extends Component {
    static components = { ResourcePage };
    static props = { ...standardActionServiceProps };
    static template = xml`<ResourcePage/>`;
}

registry.category("actions").add("t9n.open_resource_page", OpenResourcePage);
