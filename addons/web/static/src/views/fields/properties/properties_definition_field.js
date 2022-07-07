/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "../standard_field_props";
import { PropertyDefinition } from "./property_definition";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

const { Component, onWillUpdateProps, useRef } = owl;

export class PropertiesDefinitionField extends Component {
    setup() {
        this.propertiesDefinitionRef = useRef('propertiesDefinition');
    }

    /**
     * Generate a unique property id.
     */
    uuid() {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        // Uint8Array to hex
        return [...array].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    get context() {
        return this.props.record.getFieldContext(this.props.name);
    }

    /**
     * Return the current property value.
     *
     * Make a deep copy of this property value, so when we will modify it
     * in the events, we won't re-use same object (can lead to issue, e.g. if we
     * discard a form view, we should be able to restore the old props).
     */
    get propertyDefinition () {
        return JSON.parse(JSON.stringify(this.props.value || []));
    }

    onPropertyChange(propertyIndex, propertyValue) {
        const value = this.propertyDefinition;
        value[propertyIndex] = propertyValue;
        this.props.update(value);
    }

    onDeleteProperty(propertyIndex) {
        console.log('Delete property', propertyIndex);
        const value = this.propertyDefinition;
        value.splice(propertyIndex, 1);
        this.props.update(value);
    }

    onNewProperty() {
        const value = this.propertyDefinition || [];

        if(value.length && value.some(prop => !prop.string || !prop.string.length)) {
            // do not allow to add new field until we set a label on the previous one
            // set the focus on the last label input if it's empty
            this.propertiesDefinitionRef.el
                .closest('.o_field_properties_definition')
                .classList.add('o_field_invalid');
            // remove the focus on the current element to have the invalid effect
            this.propertiesDefinitionRef.el
                .querySelector('.o_field_properties_definition_add').blur();
            return
        }

        value.push({'id': this.uuid(), 'type': 'boolean'});
        this.props.update(value);
    }
}

PropertiesDefinitionField.template = "web.PropertiesDefinitionField";
PropertiesDefinitionField.components = {
    Dropdown,
    DropdownItem,
    PropertyDefinition,
};
PropertiesDefinitionField.props = {
    ...standardFieldProps,
};

PropertiesDefinitionField.displayName = _lt("Properties Definition");
PropertiesDefinitionField.supportedTypes = ["properties_definition"];

registry.category("fields").add("properties_definition", PropertiesDefinitionField);
