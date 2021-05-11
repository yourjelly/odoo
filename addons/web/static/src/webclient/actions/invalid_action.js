/** @odoo-module */

import { registry } from "@web/core/registry";
import ControlPanel from "web.ControlPanel";
import { breadcrumbsToLegacy } from "@web/legacy/utils";
const { Component, tags } = owl;

class InvalidAction extends Component {
    setup() {}

    get originalActionID() {
        return JSON.parse(this.props.action._originalAction).action_attempted;
    }

    get breadcrumbs() {
        return breadcrumbsToLegacy(this.props.breadcrumbs);
    }
}

InvalidAction.components = { ControlPanel };
InvalidAction.template = tags.xml`
    <div class="">
        <ControlPanel title="'Invalid Action'" action="props.action" breadcrumbs="breadcrumbs" withSearchBar="false"/>
        <h2>The action <t t-esc="originalActionID"></t> is invalid</h2>
    </div>
`;

registry.category("actions").add("invalid_action", InvalidAction);
