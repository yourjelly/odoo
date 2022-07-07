/** @odoo-module **/

// Represent 1 property definition
// Will be use by "properties_definition"

import { _lt } from "@web/core/l10n/translation";
import { standardFieldProps } from "../standard_field_props";
import { PropertyValue } from "./property_value";
import { PropertySelection } from "./property_selection";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { useService } from "@web/core/utils/hooks";
import { PropertyTagsDefinition } from "./property_tags_definition";

const { Component, useState, onWillUpdateProps } = owl;

export class PropertyDefinition extends Component {

    setup() {
        this.orm = useService("orm");

        const defaultValues = {
            'id': false,
            'string': '',
            'type': 'boolean',
            'default': '',
        };
        const value = {...defaultValues, ...this.props.value};

        this.state = useState({
            value: value,
            typeLabel: this.typeLabel(value.type),
            modelId: 0,
            modelDescription: '',
        });

        this._onPropertyValueChange(value);

        onWillUpdateProps((newProps) => {
            this._onPropertyValueChange(newProps.value);
        });
    }

    /**
     * The property value changed (e.g. we discard a form view editing).
     *
     * Re-update the state with the new props.
     */
    _onPropertyValueChange(propertyValue) {
        const currentModel = this.state.model;
        const newModel = propertyValue.model;

        this.state.value = propertyValue;
        this.state.typeLabel = this.typeLabel(propertyValue.type);

        if (newModel && newModel !== currentModel) {
            // retrieve the model id and the model description from it's name
            // "res.partner" => (5, "Contact")
            this.orm.call(
                'ir.model',
                'search_read',
                [
                    [['model', '=', newModel]],
                    ['id', 'name'],
                ],
            ).then(result => {
                if (!result || !result.length) {
                    return;
                }
                this.state.modelId = result[0].id;
                this.state.modelDescription = result[0].name;
            });
        } else if (!newModel) {
            this.state.modelId = false;
            this.state.modelDescription = '';
        }
    }

    /* --------------------------------------------------------
     * Getters
     * -------------------------------------------------------- */

    get availablePropertiesType() {
        return [
            ['boolean', _lt('Checkbox')],
            ['integer', _lt('Integer')],
            ['float', _lt('Decimal')],
            ['char', _lt('Text')],
            ['date', _lt('Date')],
            ['datetime', _lt('Date & Time')],
            ['selection', _lt('Selection')],
            ['tags', _lt('Tags')],
            ['many2one', _lt('Many2one')],
            ['many2many', _lt('Many2many')],
        ];
    }

    /* --------------------------------------------------------
     * Helpers
     * -------------------------------------------------------- */

    /**
     * Return the property label corresponding to the property type
     */
     typeLabel(propertyType) {
        const allTypes = this.availablePropertiesType;
        return allTypes.find(type => type[0] === propertyType)[1];
     }

    /* --------------------------------------------------------
     * Events
     * -------------------------------------------------------- */

    /**
     * We changed the string of the property
     */
    onStringChange(event) {
        const newString = event.target.value;
        const value = {...this.state.value, 'string': newString};

        this.props.onChange(value);
        this.state.value = value;
    }

    /**
     * We changed the default value of the property
     */
    onDefaultChange(newDefault) {
        console.log('onDefaultChange', newDefault);
        const value = {...this.state.value, 'default': newDefault};

        this.props.onChange(value);
        this.state.value = value;
    }

    /**
     * We selected a new property type
     */
    onSelectType(newType) {
        const value = {...this.state.value, 'type': newType, 'default': false};

        this.props.onChange(value);
        this.state.value = value;
        this.state.typeLabel = this.typeLabel(newType);
    }

    onModelChange(newModel) {
        console.log('onModelChange', newModel);
        if (!newModel || !newModel.length || !newModel[0].id) {
            // remove the model
            const value = {...this.state.value, 'model': false, 'default': false};
            this.props.onChange(value);
            this.state.value = value;
            return;
        }
        const newModelId = newModel[0].id;
        const newModelDescription = newModel[0].name;

        // if we change the model, we should reset the default value
        const resetDefault = newModelId === this.state.modelId
            ? this.state.value.default
            : false;

        this.state.modelId = newModelId;
        this.state.modelDescription = newModelDescription;

        this.orm.call(
            'ir.model',
            'read',
            [
                [newModelId],
                ['model'],
            ],
        ).then(result => {
            if (!result || !result.length) {
                return;
            }
            const value = {
                ...this.state.value,
                'model': result[0].model,
                'default': resetDefault,
            };
            this.props.onChange(value);
            this.state.value = value;

        });
    }

    onSelectionLabelChange(newOptions) {
        const value = {...this.state.value, 'selection': newOptions};
        this.props.onChange(value);
        this.state.value = value;
    }

    onTagsChange(newTags) {
        console.log('onTagsChange', newTags);

        const value = {...this.state.value, 'tags': newTags};
        this.props.onChange(value);
        this.state.value = value;
    }
}

PropertyDefinition.template = "web.PropertyDefinition";
PropertyDefinition.components = {
    Dropdown,
    DropdownItem,
    PropertyValue,
    PropertySelection,
    Many2XAutocomplete,
    PropertyTagsDefinition,
};
PropertyDefinition.props = {
    readonly: { type: Boolean, optional: true },
    value: { optional: true },
    context: { type: Object },
    onChange: { type: Function, optional: true },
};
