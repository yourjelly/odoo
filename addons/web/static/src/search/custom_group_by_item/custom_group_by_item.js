/** @odoo-module **/

import { SelectMenu } from "@web/core/select_menu/select_menu";
import { Component, useState } from "@odoo/owl";

export class CustomGroupByItem extends Component {
    setup() {
        this.state = useState({});
        if (this.props.fields.length) {
            this.state.fieldName = this.props.fields[0].name;
        }
    }

    get choices() {
        return this.props.fields.map((f) => ({ label: f.string, value: f.name }));
    }

    onSelected(ev) {
        if (ev.target.value) {
            this.props.onAddCustomGroup(ev.target.value);
            // reset the placeholder
            ev.target.value = "";
        }
    }
}

CustomGroupByItem.template = "web.CustomGroupByItem";
CustomGroupByItem.components = { SelectMenu };
CustomGroupByItem.props = {
    fields: Array,
    onAddCustomGroup: Function,
};
