/** @odoo-module **/

import { registry } from "@web/core/registry";
import { ViewButton } from "@web/views/view_button/view_button";
// import { standardFieldProps } from "../standard_field_props";
import { Component } from "@odoo/owl";

export class SmartButtonField extends Component {
    get title() {
        return this.props.record.activeFields[this.props.name].string;
    }
}

SmartButtonField.template = "web.SmartButtonField";
// SmartButtonField.defaultProps = {};
// SmartButtonField.props = {
//     ...standardFieldProps,
//     icon: { type: String, optional: true },
// };
SmartButtonField.components = { ViewButton };
SmartButtonField.noLabel = true;

// SmartButtonField.displayName = _lt("Status");
// SmartButtonField.supportedTypes = ["many2one", "selection"];

// SmartButtonField.isEmpty = (record, fieldName) => {
//     return record.model.env.isSmall ? !record.data[fieldName] : false;
//};
SmartButtonField.extractProps = ({ attrs }) => {
    return {
        icon: attrs.options.icon,
        clickParams: {
            type: attrs.options.type,
            name: attrs.options.name,
        },
    };
};

registry.category("fields").add("smart_button", SmartButtonField);
