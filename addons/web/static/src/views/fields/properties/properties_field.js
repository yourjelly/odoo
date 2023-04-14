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
import { reposition } from "@web/core/position_hook";
import { archParseBoolean } from "@web/views/utils";

import { Component, useRef, useState, useEffect, onWillStart } from "@odoo/owl";

export class PropertiesField extends Component {
    static template = "web.PropertiesField";
    static components = {
        Dropdown,
        DropdownItem,
        PropertyDefinition,
        PropertyValue,
    };
    static props = {
        ...standardFieldProps,
        context: { type: Object, optional: true },
        columns: { type: Number, optional: true },
        hideAddButton: { type: Boolean, optional: true },
        hideKanbanOption: { type: Boolean, optional: true },
    };

    setup() {
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.user = useService("user");
        this.dialogService = useService("dialog");
        this.popover = usePopover(PropertyDefinition, {
            closeOnClickAway: this.checkPopoverClose,
            popoverClass: "o_property_field_popover",
            position: "top",
            onClose: () => this.onCloseCurrentPopover?.(),
        });
        this.propertiesRef = useRef("properties");

        this.state = useState({
            canChangeDefinition: true,
            movedPropertyName: null,
            unfoldedSeparators: [],
            hideAddButton: this.props.hideAddButton,
        });

        this._saveInitialPropertiesValues();

        const field = this.props.record.fields[this.props.name];
        this.definitionRecordField = field.definition_record;
        this._updateFoldedSeparatorsState();

        onWillStart(async () => {
            await this._checkDefinitionAccess();
        });

        useEffect(() => {
            this._movePopoverIfNeeded();

            if (this.openPropertyDefinition) {
                const propertyName = this.openPropertyDefinition;
                const labels = this.propertiesRef.el.querySelectorAll(
                    `.o_property_field[property-name="${propertyName}"] .o_field_property_open_popover`
                );
                if (!labels.length) {
                    // property still not in the DOM
                    return;
                }
                this.openPropertyDefinition = null;
                const lastLabel = labels[labels.length - 1];
                this._openPropertyDefinition(lastLabel, propertyName, true);
            }
        });
    }

    /* --------------------------------------------------------
     * Public methods / Getters
     * -------------------------------------------------------- */

    /**
     * Return the number of columns
     *
     * @returns {object}
     */
    get columns() {
        return this.env.isSmall ? 1 : this.props.columns;
    }

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
        const propertiesValues = JSON.parse(
            JSON.stringify(this.props.record.data[this.props.name] || [])
        );
        return propertiesValues.filter((definition) => !definition.definition_deleted);
    }

    /**
     * Return the current properties value splitted in multiple groups/columns.
     *
     * @returns {Array<Array>}
     */
    get groupedPropertiesList() {
        const propertiesList = this.propertiesList;
        propertiesList.push({ nextProperty: true }); // flag to know where will be inserted the next property

        // default invisible group
        const groupedProperties =
            propertiesList[0].type !== "separator"
                ? [{ title: null, name: null, elements: [], invisible: true }]
                : [];

        propertiesList.forEach((property) => {
            if (property.type === "separator") {
                groupedProperties.push({
                    title: property.string,
                    name: property.name,
                    elements: [],
                });
            } else {
                groupedProperties[groupedProperties.length - 1].elements.push(property);
            }
        });

        if (groupedProperties.length === 1) {
            // only one group, split this group in the columns to take the entire width
            const invisible = !groupedProperties[0].name;
            groupedProperties[0].elements = [];
            groupedProperties[0].invisible = invisible;
            for (let col = 1; col < this.columns; ++col) {
                groupedProperties.push({
                    title: null,
                    name: groupedProperties[0].name,
                    elements: [],
                    invisible,
                });
            }
            propertiesList
                .filter((property) => property.type !== "separator")
                .forEach((property, index) => {
                    groupedProperties[index % this.columns].elements.push(property);
                });
        }

        return groupedProperties;
    }

    /**
     * Return true if we should close the popover containing the
     * properties definition based on the target received.
     *
     * If we edit the datetime, it will open a popover with the date picker
     * component, but this component won't be a child of the current popover.
     * So when we will click on it to select a date, it will close the definition
     * popover. It's the same for other similar components (many2one modal, etc).
     *
     * @param {HTMLElement} target
     * @returns {boolean}
     */
    checkPopoverClose(target) {
        if (target.closest(".bootstrap-datetimepicker-widget")) {
            // selected a datetime, do not close the definition popover
            return false;
        }

        if (target.closest(".modal")) {
            // close a many2one modal
            return false;
        }

        if (target.closest(".o_tag_popover")) {
            // tag color popover
            return false;
        }

        if (target.closest(".o_model_field_selector_popover")) {
            // domain selector
            return false;
        }

        return true;
    }

    /**
     * Generate an unique ID to be used in the DOM.
     *
     * @returns {string}
     */
    generateUniqueDomID() {
        return `property_${uuid()}`;
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
            (property) => property.name === propertyName
        );

        const targetIndex = propertyIndex + (direction === "down" ? 1 : -1);
        if (targetIndex < 0 || targetIndex >= propertiesValues.length) {
            this.notification.add(
                direction === "down"
                    ? _lt("This field is already last")
                    : _lt("This field is already first"),
                { type: "warning" }
            );
            return;
        }
        this.state.movedPropertyName = propertyName;

        const prop = propertiesValues[targetIndex];
        propertiesValues[targetIndex] = propertiesValues[propertyIndex];
        propertiesValues[propertyIndex] = prop;
        propertiesValues[propertyIndex].definition_changed = true;

        this._unfoldPropertyGroup(targetIndex, propertiesValues);

        this.props.record.update({ [this.props.name]: propertiesValues }).then(() => {
            // move the popover once the DOM is updated
            this.movePopoverToProperty = propertyName;
        });
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
        propertiesValues.find((property) => property.name === propertyName).value = propertyValue;
        this.props.record.update({ [this.props.name]: propertiesValues });
    }

    /**
     * Check if the definition is not already opened
     * and if it's not the case, open the popover with the property definition.
     *
     * @param {event} event
     * @param {string} propertyName
     */
    async onPropertyEdit(event, propertyName) {
        event.stopPropagation();
        event.preventDefault();
        if (!await this.checkDefinitionWriteAccess()) {
            this.notification.add(_lt("You need to be able to edit parent first to configure property fields"), {
                type: "warning",
            });
            return;
        }
        if (event.target.classList.contains("disabled")) {
            // remove the glitch if we click on the edit button
            // while the popover is already opened
            return;
        }

        event.target.classList.add("disabled");
        this._openPropertyDefinition(event.target, propertyName, false);
    }

    /**
     * The property definition or value has been changed.
     *
     * @param {object} propertyDefinition
     */
    onPropertyDefinitionChange(propertyDefinition) {
        propertyDefinition["definition_changed"] = true;
        if (propertyDefinition.type === "separator") {
            // remove all other keys
            propertyDefinition = {
                name: propertyDefinition.name,
                string: propertyDefinition.string,
                definition_changed: propertyDefinition.definition_changed,
                type: propertyDefinition.type,
            };
        }
        const propertiesValues = this.propertiesList;
        const propertyIndex = propertiesValues.findIndex(
            (property) => property.name === propertyDefinition.name
        );

        const oldType = propertiesValues[propertyIndex].type;
        const newType = propertyDefinition.type;

        this._regeneratePropertyName(propertyDefinition);

        propertiesValues[propertyIndex] = propertyDefinition;
        this.props.record.update({ [this.props.name]: propertiesValues });

        if (newType === "separator" && oldType !== newType) {
            // unfold automatically the new separator
            this.onSeparatorClick(propertyDefinition.name, true);
        }
        if ([newType, oldType].includes("separator") && oldType !== newType) {
            // layout has been changed, move the definition popover
            this.movePopoverToProperty = propertyDefinition.name;
        }
    }

    /**
     * Mark a property as "to delete".
     *
     * @param {string} propertyName
     */
    onPropertyDelete(propertyName) {
        const dialogProps = {
            title: _lt("Delete Property Field"),
            body: sprintf(
                _lt(
                    'Are you sure you want to delete this property field? It will be removed for everyone using the "%s" %s.'
                ),
                this.parentName,
                this.parentString
            ),
            confirmLabel: _lt("Delete"),
            confirm: () => {
                this.popover.close();
                const propertiesDefinitions = this.propertiesList;
                propertiesDefinitions.find(
                    (property) => property.name === propertyName
                ).definition_deleted = true;
                this.props.record.update({ [this.props.name]: propertiesDefinitions });
            },
            cancel: () => {},
        };
        this.dialogService.add(ConfirmationDialog, dialogProps);
    }

    async onPropertyCreate() {
        if (!await this.checkDefinitionWriteAccess()) {
            this.notification.add(_lt("You need to be able to edit parent first to configure property fields"), {
                type: "warning",
            });
            return;
        }

        const propertiesDefinitions = this.propertiesList || [];

        if (
            propertiesDefinitions.length &&
            propertiesDefinitions.some((prop) => !prop.string || !prop.string.length)
        ) {
            // do not allow to add new field until we set a label on the previous one
            this.propertiesRef.el.closest(".o_field_properties").classList.add("o_field_invalid");

            this.notification.add(_lt("Please complete your properties before adding a new one"), {
                type: "warning",
            });
            return;
        }

        this._unfoldPropertyGroup(propertiesDefinitions.length - 1, propertiesDefinitions);

        this.propertiesRef.el.closest(".o_field_properties").classList.remove("o_field_invalid");

        const newName = uuid();
        propertiesDefinitions.push({
            name: newName,
            string: sprintf(_lt("Property %s"), propertiesDefinitions.length + 1),
            type: "char",
            definition_changed: true,
        });
        this.state.hideAddButton = false;
        this.openPropertyDefinition = newName;
        await this.props.record.update({ [this.props.name]: propertiesDefinitions });
    }

    /**
     * Fold / unfold the given separator property.
     *
     * @param {string} propertyName, Name of the separator property
     * @param {boolean} forceUnfold, Always unfold
     */
    onSeparatorClick(propertyName, forceUnfold) {
        if (!propertyName) {
            return;
        }

        let [unfoldedSeparators, fold, key] = this._getFoldedSeparatorsState();
        if (unfoldedSeparators.includes(propertyName)) {
            if (!forceUnfold) {
                unfoldedSeparators = unfoldedSeparators.filter((name) => name !== propertyName);
            }
        } else {
            unfoldedSeparators.push(propertyName);
        }
        fold[key] = unfoldedSeparators;
        window.localStorage.setItem("properties.fold", JSON.stringify(fold));
        this.state.unfoldedSeparators = unfoldedSeparators;
    }

    /**
     * Verify that we can write on properties,
     * if we don't have access for parent
     */
    async checkDefinitionWriteAccess() {
        const definitionRecordId = this.props.record.data[this.definitionRecordField][0];
        const definitionRecordModel = this.props.record.fields[this.definitionRecordField].relation;
        try {
            await this.orm.call(
                definitionRecordModel,
                "check_access_rule",
                [definitionRecordId],
                {
                    operation: "write",
                }
            );
        } catch (_e) { // eslint-disable-line no-unused-vars
            return false;
        }
        return true;
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
        const propertyDefinition = this.propertiesList.find(
            (property) => property.name === propertyName
        );
        propertyDefinition.tags = newTags;
        if (newValue !== null) {
            propertyDefinition.value = newValue;
        }
        propertyDefinition.definition_changed = true;
        this.onPropertyDefinitionChange(propertyDefinition);
    }

    /* --------------------------------------------------------
     * Private methods
     * -------------------------------------------------------- */

    /**
     * Read the local storage and return the fold state stored in it.
     *
     * We clean the dictionary state because a property might have been deleted,
     * and so there's no reason to keep the corresponding key in the dict.
     *
     * @returns {array}
     *      - The folded state
     *      - The object storing all state for all definition record
     *      - The key storing the folded state in the previous object
     */
    _getFoldedSeparatorsState() {
        const fold = JSON.parse(window.localStorage.getItem("properties.fold")) || {};
        const definitionRecordId = this.props.record.data[this.definitionRecordField][0];
        const definitionRecordModel = this.props.record.fields[this.definitionRecordField].relation;
        // store the fold / unfold information per definition record
        // to clean the keys (to not keep information about removed separator)
        const key = `${definitionRecordModel},${definitionRecordId}`;
        const allPropertiesNames = this.propertiesList.map((property) => property.name);
        let unfoldedSeparators = fold[key] || [];
        // remove element that do not exist anymore (e.g. if we remove a separator)
        unfoldedSeparators = unfoldedSeparators.filter((name) => allPropertiesNames.includes(name));
        return [unfoldedSeparators, fold, key];
    }

    /**
     * Move the popover to the given property id.
     * Used when we change the position of the properties.
     *
     * We change the popover position after the DOM has been updated (see @useEffect)
     * because if we update it after changing the component properties,
     */
    _movePopoverIfNeeded() {
        if (!this.movePopoverToProperty) {
            return;
        }
        const propertyName = this.movePopoverToProperty;
        this.movePopoverToProperty = null;

        const popover = document
            .querySelector(".o_field_property_definition")
            .closest(".o_popover");
        const targetElement = document.querySelector(
            `*[property-name="${propertyName}"] .o_field_property_open_popover`
        );

        reposition(targetElement, popover, null, { position: "top", margin: 10 });

        const arrow = popover.querySelector(".popover-arrow");
        if (arrow) {
            arrow.classList.add("d-none");
        }
    }

    /**
     * Verify that we can write on the parent record,
     * and therefor update the properties definition.
     */
    async _checkDefinitionAccess() {
        const definitionRecordId = this.props.record.data[this.definitionRecordField][0];
        this.parentName = this.props.record.data[this.definitionRecordField][1];
        const definitionRecordModel = this.props.record.fields[this.definitionRecordField].relation;
        this.parentString = this.props.record.fields[this.definitionRecordField].string;

        if (!definitionRecordId || !definitionRecordModel) {
            return;
        }

        // check if we can write on the definition record
        this.state.canChangeDefinition = await this.user.checkAccessRight(
            definitionRecordModel,
            "write"
        );
    }

    /**
     * Regenerate a new name if needed or restore the original one.
     * (see @_saveInitialPropertiesValues).
     *
     * If the type / model are the same, restore the original name to not reset the
     * children otherwise, generate a new value so all value of the record are reset.
     *
     * @param {object} propertyDefinition
     */
    _regeneratePropertyName(propertyDefinition) {
        const initialValues = this.initialValues[propertyDefinition.name];
        if (
            initialValues &&
            propertyDefinition.type === initialValues.type &&
            propertyDefinition.comodel === initialValues.comodel
        ) {
            // restore the original name
            propertyDefinition.name = initialValues.name;
        } else if (initialValues && initialValues.name === propertyDefinition.name) {
            // Generate a new name to reset all values on other records.
            // because the name has been changed on the definition,
            // the old name on others record won't match the name on the definition
            // and the python field will just ignore the old value.
            // Store the new generated name to be able to restore it
            // if needed.
            const newName = uuid();
            this.initialValues[newName] = initialValues;
            propertyDefinition.name = newName;
        }
    }

    /**
     * If we change the type / model of a property, we will regenerate it's name
     * (like if it was a new property) in order to reset the value of the children.
     *
     * But if we reset the old model / type, we want to be able to discard this
     * modification (even if we save) and restore the original name.
     *
     * For that purpose, we save the original properties values.
     */
    _saveInitialPropertiesValues() {
        // initial properties values, if the type or the model changed, the
        // name will be regenerated in order to reset the value on the children
        this.initialValues = {};
        for (const propertiesValues of this.props.record.data[this.props.name] || []) {
            this.initialValues[propertiesValues.name] = {
                name: propertiesValues.name,
                type: propertiesValues.type,
                comodel: propertiesValues.comodel,
            };
        }
    }

    /**
     * Open the popover with the property definition.
     *
     * @param {DomElement} target
     * @param {string} propertyName
     * @param {boolean} isNewlyCreated
     */
    _openPropertyDefinition(target, propertyName, isNewlyCreated = false) {
        const propertiesList = this.propertiesList;
        const propertyIndex = propertiesList.findIndex(
            (property) => property.name === propertyName
        );

        // maybe the property has been renamed because the type / model
        // changed, retrieve the new one
        const currentName = (propertyName) => {
            const propertiesList = this.propertiesList;
            for (const [newName, initialValue] of Object.entries(this.initialValues)) {
                if (initialValue.name === propertyName) {
                    const prop = propertiesList.find((prop) => prop.name === newName);
                    if (prop) {
                        return newName;
                    }
                }
            }
            return propertyName;
        };

        this.onCloseCurrentPopover = () => {
            this.onCloseCurrentPopover = null;
            this.state.movedPropertyName = null;
            target.classList.remove("disabled");
            if (isNewlyCreated) {
                this._setDefaultPropertyValue(currentName(propertyName));
            }
        };

        this.popover.open(target, {
            readonly: this.props.readonly || !this.state.canChangeDefinition,
            canChangeDefinition: this.state.canChangeDefinition,
            checkDefinitionWriteAccess: () => this.checkDefinitionWriteAccess(),
            propertyDefinition: this.propertiesList.find(
                (property) => property.name === currentName(propertyName)
            ),
            context: this.props.context,
            onChange: this.onPropertyDefinitionChange.bind(this),
            onDelete: () => this.onPropertyDelete(currentName(propertyName)),
            onPropertyMove: (direction) =>
                this.onPropertyMove(currentName(propertyName), direction),
            isNewlyCreated: isNewlyCreated,
            propertyIndex: propertyIndex,
            propertiesSize: propertiesList.length,
            hideKanbanOption: this.props.hideKanbanOption,
        });
    }

    /**
     * Write the default value on the given property.
     *
     * @param {string} propertyName
     */
    _setDefaultPropertyValue(propertyName) {
        const propertiesValues = this.propertiesList;
        const newProperty = propertiesValues.find((property) => property.name === propertyName);
        newProperty.value = newProperty.default;
        // it won't update the props, it's a trick because the onClose event of the popover
        // is called not synchronously, and so if we click on "create a property", it will close
        // the popover, calling this function, but the value will be overwritten because of onPropertyCreate
        this.props.value = propertiesValues;
        this.props.record.update({ [this.props.name]: propertiesValues });
    }

    /**
     * Read the fold states in the local storage,
     * and update the state of the current component.
     */
    _updateFoldedSeparatorsState() {
        const unfoldedSeparators = this._getFoldedSeparatorsState()[0];
        this.state.unfoldedSeparators = unfoldedSeparators;
    }

    /**
     * Unfold the group of the given property.
     *
     * @param {integer} targetIndex
     * @param {object} propertiesValues
     */
    _unfoldPropertyGroup(targetIndex, propertiesValues) {
        const separator = propertiesValues.findLast(
            (property, index) => property.type === "separator" && index <= targetIndex
        );
        if (separator) {
            this.onSeparatorClick(separator.name, true);
        }
    }
}

export const propertiesField = {
    component: PropertiesField,
    displayName: _lt("Properties"),
    supportedTypes: ["properties"],
    extractProps({ attrs }, dynamicInfo) {
        return {
            context: dynamicInfo.context,
            columns: parseInt(attrs.columns || "1"),
            hideAddButton: archParseBoolean(attrs.hideAddButton),
            hideKanbanOption: archParseBoolean(attrs.hideKanbanOption),
        };
    },
};

registry.category("fields").add("properties", propertiesField);

async function actionAddProperty(env) {
    const addProperty = document.querySelector(".o_field_property_add button");
    if (addProperty) {
        addProperty.click();
    } else {
        const message = sprintf(env._t("You can not create a new property."));
        env.services.notification.add(message, { type: "danger" });
    }
}

registry.category("actions").add("action_configure_properties_field", actionAddProperty);
