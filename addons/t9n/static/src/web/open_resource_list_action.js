import { Component, xml } from "@odoo/owl";

import { ResourceList } from "@t9n/core/resource_list";
import { registry } from "@web/core/registry";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

export class OpenResourceList extends Component {
    static components = { ResourceList };
    static props = { ...standardActionServiceProps };
    static template = xml`<ResourceList/>`;
}

registry.category("actions").add("t9n.open_resource_list", OpenResourceList);
