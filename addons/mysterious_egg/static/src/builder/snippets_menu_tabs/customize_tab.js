import { Component, useSubEnv } from "@odoo/owl";
import { Toolbar } from "@html_editor/main/toolbar/toolbar";
import { WithSubEnv } from "../builder_helpers";

export class CustomizeTab extends Component {
    static template = "mysterious_egg.CustomizeTab";
    static components = { Toolbar, WithSubEnv };
    setup() {
        useSubEnv({ editor: this.props.editor });
    }
}
