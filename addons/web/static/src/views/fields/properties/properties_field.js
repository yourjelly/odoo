/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "../standard_field_props";
import { PropertyValue } from "./property_value";


const { Component, useState } = owl;

export class PropertiesField extends Component {
    setup() {
        console.log('PropertiesField');
    }

    onPropertyChange(propertyIndex, propertyValue) {
        // Make a deep copy of this property value, so when we will modify it
        // in the events, we won't re-use same object (can lead to issue, e.g. if we
        // discard a form view, we should be able to restore the old props).
        const value = JSON.parse(JSON.stringify(this.props.value));
        value[propertyIndex].value = propertyValue;
        this.props.update(value);
    }

    get context() {
        return this.props.record.getFieldContext(this.props.name);
    }

}

PropertiesField.template = "web.PropertiesField";
PropertiesField.components = {
    PropertyValue,
};
PropertiesField.props = {
    ...standardFieldProps,
};

PropertiesField.displayName = _lt("Properties");

registry.category("fields").add("properties", PropertiesField);
