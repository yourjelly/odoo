/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "../standard_field_props";
import { uuid } from "../../utils";
import { PropertyDefinition } from "./property_definition";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { PropertyValue } from "./property_value";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { sprintf } from "@web/core/utils/strings";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

const { Component, useRef, useState, useEffect, onWillStart } = owl;

export class PropertiesField extends Component {
    setup() {
        this.notification = useService('notification');
        this.orm = useService('orm');
        this.dialogService = useService('dialog');
        this.popover = usePopover();
        this.propertiesRef = useRef('properties');

        this.state = useState({
            canChangeDefinition: true,
            movedPropertyName: null,
        });

        const field = this.props.record.fields[this.props.name];
        this.parentField = field.parent_field;

        onWillStart(async () => {
            await this._checkParentAccess();
        });

        useEffect(
            () => {
                this._movePopoverIfNeeded();

                if (this.openLastPropertyDefinition) {
                    this.openLastPropertyDefinition = null;
                    const propertiesList = this.propertiesList;
                    const lastPropertyName = propertiesList[propertiesList.length - 1].name;
                    const labels = this.propertiesRef.el.querySelectorAll(
                        `.o_property_field[property-name="${lastPropertyName}"] .o_field_property_open_popover`);
                    const lastLabel = labels[labels.length - 1];
                    lastLabel.click();
                }
            },
        );
    }

    /* --------------------------------------------------------
     * Public methods / Getters
     * -------------------------------------------------------- */

    /**
     * Return the current context
     *
     * @returns {object}
     */
    get context() {
        return this.props.record.getFieldContext(this.props.name);
    }

    /**
     * Return the current properties value.
     *
     * Make a deep copy of this properties values, so when we will modify it
     * in the events, we won't re-use same object (can lead to issue, e.g. if we
     * discard a form view, we should be able to restore the old props).
     *
     * @returns {array}
     */
    get propertiesList() {
        const propertiesValues = JSON.parse(JSON.stringify(this.props.value || []));
        return propertiesValues.filter(definition => !definition.definition_deleted);
    }

    /**
     * Return false if we should not close the popover containing the
     * properties definition based on the event received.
     *
     * If we edit the datetime, it will open a popover with the date picker
     * component, but this component won't be a child of the current popover.
     * So when we will click on it to select a date, it will close the definition
     * popover. It's the same for other similar components (many2one modal, etc).
     *
     * @param {event} event
     * @returns {boolean}
     */
    checkPopoverClose(event) {
        if (document.activeElement.closest('.o_field_property_definition')) {
            // the focus is still on an element of the definition
            return true;
        }

        if (event.target.closest('.bootstrap-datetimepicker-widget')) {
            // selected a datetime, do not close the definition popover
            return true;
        }

        if (event.target.closest('.modal')) {
            // close a many2one modal
            return true;
        }

        return false;
    }

    /* --------------------------------------------------------
     * Event handlers
     * -------------------------------------------------------- */

    /**
     * Move the given property up or down in the list.
     *
     * @param {string} propertyName
     * @param {string} direction, either "up" or "down"
     */
    onPropertyMove(propertyName, direction) {
        const propertiesValues = this.propertiesList || [];
        const propertyIndex = propertiesValues.findIndex(
            property => property.name === propertyName);

        const targetIndex = propertyIndex + (direction === 'down' ? 1 : -1);
        if (targetIndex < 0 || targetIndex >= propertiesValues.length) {
            this.notification.add(
                direction === 'down'
                ? _lt('This field is already last')
                : _lt('This field is already first'),
                { type: 'warning' },
            );
            return;
        }
        this.state.movedPropertyName = propertyName;

        const tmp = propertiesValues[targetIndex];
        propertiesValues[targetIndex] = propertiesValues[propertyIndex];
        propertiesValues[propertyIndex] = tmp;
        propertiesValues[propertyIndex].definition_changed = true;
        this.props.update(propertiesValues);
        // move the popover once the DOM is updated
        this.shouldUpdatePopoverPosition = true;
    }

    /**
     * The value / definition of the given property has been changed.
     * `propertyValue` contains the definition of the property with the value.
     *
     * @param {string} propertyName
     * @param {object} propertyValue
     */
    onPropertyValueChange(propertyName, propertyValue) {
        const propertiesValues = this.propertiesList;
        propertiesValues.find(property => property.name === propertyName).value = propertyValue;
        this.props.update(propertiesValues);
    }

    /**
     * The tags list has been changed.
     * If `newValue` is given, update the property value as well.
     *
     * @param {string} propertyName
     * @param {array} newTags
     * @param {array | null} newValue
     */
    onTagsChange(propertyName, newTags, newValue = null) {
        const propertyDefinition = this.propertiesList.find(property => property.name === propertyName);
        propertyDefinition.tags = newTags;
        if (newValue !== null) {
            propertyDefinition.value = newValue;
        }
        propertyDefinition.definition_changed = true;
        this.onPropertyDefinitionChange(propertyName, propertyDefinition);
    }

    /**
     * Open the popover with the property definition.
     *
     * @param {event} event
     * @param {string} propertyName
     */
    onPropertyEdit(event, propertyName) {
        if (event.target.classList.contains('disabled')) {
            event.stopPropagation();
            event.preventDefault();
            // remove the glitch if we click on the edit button
            // while the popover is already opened
            return;
        }

        event.target.classList.add('disabled');

        this.popoverCloseFn = this.popover.add(
            event.currentTarget,
            PropertyDefinition,
            {
                readonly: this.props.readonly || !this.state.canChangeDefinition,
                canChangeDefinition: this.state.canChangeDefinition,
                propertyDefinition: this.propertiesList.find(property => property.name === propertyName),
                context: this.context,
                onChange: (propertyDefinition) => this.onPropertyDefinitionChange(propertyName, propertyDefinition),
                onDelete: () => this.onPropertyDelete(propertyName),
                onPropertyMove: (direction) => this.onPropertyMove(propertyName, direction),
            },
            {
                preventClose: this.checkPopoverClose,
                popoverClass: 'o_property_field_popover',
                position: 'top',
                onClose: () => {
                    this.state.movedPropertyName = null;
                    event.target.classList.remove('disabled');
                },
            },
        );
    }

    /**
     * The property definition or value has been changed.
     *
     * @param {string} propertyName
     * @param {object} propertyDefinition
     */
    onPropertyDefinitionChange(propertyName, propertyDefinition) {
        propertyDefinition['definition_changed'] = true;
        const propertiesValues = this.propertiesList;
        const propertyIndex = propertiesValues.findIndex(
            property => property.name === propertyName);
        propertiesValues[propertyIndex] = propertyDefinition;
        this.props.update(propertiesValues);
    }

    /**
     * Mark a property as "to delete".
     *
     * @param {string} propertyName
     */
    onPropertyDelete(propertyName) {
        const dialogProps = {
            title: _lt('Delete Property Field'),
            body: sprintf(_lt(
                'Are you sure you want to delete this property field? It will be removed for everyone using the "%s" %s.'),
                this.parentName, this.parentString),
            confirm: () => {
                if (this.popoverCloseFn) {
                    this.popoverCloseFn();
                    this.popoverCloseFn = null;
                }
                const propertiesDefinitions = this.propertiesList;
                propertiesDefinitions
                    .find(property => property.name === propertyName)
                    .definition_deleted = true;
                this.props.update(propertiesDefinitions);
            },
            cancel: () => {},
        };
        this.dialogService.add(ConfirmationDialog, dialogProps);
    }

    onPropertyCreate() {
        const propertiesDefinitions = this.propertiesList || [];

        if (propertiesDefinitions.length
            && propertiesDefinitions.some(prop => !prop.string || !prop.string.length)) {
            // do not allow to add new field until we set a label on the previous one
            this.propertiesRef.el
                .closest('.o_field_properties')
                .classList.add('o_field_invalid');

            this.notification.add(
                _lt('Please complete your properties before adding a new one'),
                { type: 'warning' },
            );
            return;
        }

        this.propertiesRef.el
            .closest('.o_field_properties')
            .classList.remove('o_field_invalid');

        propertiesDefinitions.push({
            name: uuid(),
            string: sprintf(_lt('Property %s'), propertiesDefinitions.length + 1),
            type: 'char',
            definition_changed: true,
        });
        this.openLastPropertyDefinition = true;
        this.props.update(propertiesDefinitions);
    }

    /* --------------------------------------------------------
     * Private methods
     * -------------------------------------------------------- */

    /**
     * Move the popover to the given property id.
     * Used when we change the position of the properties.
     *
     * We change the popover position after the DOM has been updated (see @useEffect)
     * because if we update it after changing the component properties,
     */
    _movePopoverIfNeeded() {
        if (!this.shouldUpdatePopoverPosition) {
            return;
        }
        this.shouldUpdatePopoverPosition = false;

        const propertyName = this.state.movedPropertyName;
        const popover = document.querySelector('.o_field_property_definition').closest('.o_popover');
        const targetElement = document.querySelector(`.o_property_field[property-name="${propertyName}"]`);
        const targetPosition = targetElement.getBoundingClientRect();
        const popoverPosition = popover.getBoundingClientRect();

        popover.style.top = (targetPosition.top - popoverPosition.height - 10) + 'px';
        popover.style.left = targetPosition.left + 'px';
        popover.style.position = 'absolute';
    }

    /**
     * Verify that we can write on the parent record,
     * and therefor update the properties definition.
     */
    async _checkParentAccess() {
        const parentId = this.props.record.data[this.parentField][0];
        this.parentName = this.props.record.data[this.parentField][1];
        const parentModel = this.props.record.fields[this.parentField].relation;
        this.parentString = this.props.record.fields[this.parentField].string;

        if (!parentId || !parentModel) {
            return;
        }

        // check if we can write on the parent
        this.state.canChangeDefinition = await this.orm.call(
            parentModel,
            'check_access_rights',
            ['write', false],
        );
    }
}

PropertiesField.template = 'web.PropertiesField';
PropertiesField.components = {
    Dropdown,
    DropdownItem,
    PropertyDefinition,
    PropertyValue,
};
PropertiesField.props = {
    ...standardFieldProps,
    columns: { type: Number, optional: true },
};
PropertiesField.extractProps = ({ attrs, field }) => {
    const columns = parseInt(attrs.columns || '1');
    return { columns };
};

PropertiesField.displayName = _lt('Properties');
PropertiesField.supportedTypes = ['properties'];

registry.category('fields').add('properties', PropertiesField);
