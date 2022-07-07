/** @odoo-module **/

// Represent 1 property value
// Support many type and instantiate the appropriate component for it

import { _lt } from "@web/core/l10n/translation";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { CheckBox } from "@web/core/checkbox/checkbox";
import { DateTimePicker, DatePicker } from "@web/core/datepicker/datepicker";
import { Many2XAutocomplete, useOpenMany2XRecord } from "@web/views/fields/relational_utils";
import { useService } from "@web/core/utils/hooks";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";
import { m2oTupleFromData } from "@web/views/fields/many2one/many2one_field";

import { AutoComplete } from "@web/core/autocomplete/autocomplete";


const { Component, onWillUpdateProps, useState } = owl;
const { DateTime } = luxon;

export class PropertyValue extends Component {

    DATETIME_FORMAT = 'yyyy-LL-dd HH:mm:ss';
    DATE_FORMAT = 'yyyy-LL-dd';

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.openMany2X = useOpenMany2XRecord({
            resModel: this.props.model,
            activeActions: {
                canCreate: false,
                canCreateEdit: false,
                canWrite: true,
            },
            isToMany: false,
            onRecordSaved: async (record) => {
                // maybe the record display name has changed
                await record.load();
                const recordData = m2oTupleFromData(record.data);
                this.onValueChange([{id: recordData[0], name: recordData[1]}]);
            },
            fieldString: this.props.string,
        });
    }

    /**
     * Return the value of the current property,
     * that will be used by the sub-components.
     */
    get propertyValue() {
        const value = this.props.value;

        if (this.props.type === 'datetime') {
            if (typeof value === 'string') {
                const datetimeValue = DateTime.fromFormat(
                    value + ' +00:00',
                    this.DATETIME_FORMAT + ' Z',
                );
                return datetimeValue.invalid ? false : datetimeValue;
            }
            return (typeof value === 'datetime') ? value : false;
        } else if (this.props.type === 'date') {
            if (typeof value === 'string') {
                const datetimeValue = DateTime.fromFormat(value, this.DATE_FORMAT);
                return datetimeValue.invalid ? false : datetimeValue;
            }
            return (typeof value === 'date') ? value : false;
        } else if (this.props.type === 'boolean') {
            return !!value;
        } else if (this.props.type === 'selection') {
            const options = this.props.selection || [];
            const option = options.find(option => option[0] === value);
            return option && option.length === 2 && option[1] ? option[1] : _lt('None');
        } else if (this.props.type === 'many2one') {
            if (!value || value.length !== 2 || !value[0]) {
                return false;
            }
            return value;
        } else if (this.props.type === 'many2many') {
            if (!value) {
                return [];
            }
            // Convert to TagList format
            return value.map((many2manyValue) => {
                return {
                    'id': many2manyValue[0],
                    'text': many2manyValue[1],
                    'onClick': () => this._openRecord(this.props.model, many2manyValue[0]),
                    'onDelete': !this.props.readonly && (() => this.onMany2manyDelete(many2manyValue[0])),
                    'colorIndex': 0,
                };
            });
        } else if (this.props.type === 'tags') {
            // Convert to TagList format
            if (!value || !this.props.tags) {
                return [];
            }
            // ['a', 'b'] =>  [['a', 'A', 5], ['b', 'B', 6]]
            const tagValue = this.props.tags.filter(tag => value.indexOf(tag[0]) >= 0);

            return tagValue.map((tag) => {
                return {
                    'id': tag[0],
                    'text': tag[1],
                    'colorIndex': tag[2],
                    'onDelete': !this.props.readonly && (() => this.onTagDelete(tag[0])),
                };
            });
        }

        return value;
    }

    get tagsAutocomplete() {
        return [{ options: this.onTagSearch.bind(this) }];
    }

    onTagSearch(search) {
        if (this.props.type !== 'tags' || !this.props.tags) {
            return [];
        }

        const tagsFiltered = this.props.tags.filter(tag =>
            (!this.props.value || this.props.value.indexOf(tag[0]) < 0)
            && (
                !search || !search.length
                || tag[1].toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) >= 0
            )
        );

        return tagsFiltered.map((tag) => {
            return {
                value: tag[0],
                label: tag[1],
            }
        });
    }

    /**
     * Formatted value displayed in readonly mode.
     */
    get displayValue() {
        const value = this.propertyValue;
        if (this.props.type === 'many2one' && value && value.length === 2) {
            return `${value[1]} (#${value[0]})`;
        } else if (!value) {
            return false;
        }
        return value.toString();
    }

    _openRecord(recordModel, recordId) {
        this.orm.call(
            recordModel,
            "get_formview_action",
            [[recordId]],
            { context: this.props.context }
        ).then((action) => {
            this.action.doAction(action);
        });
    }

    /**
     * Parse the value received by the sub-components and trigger an onChange event.
     */
    onValueChange(newValue) {
        if (this.props.type === 'datetime') {
            if (typeof newValue === 'string') {
                newValue = DateTime.fromISO(newValue);
            }
            newValue = newValue.toUTC().toFormat(this.DATETIME_FORMAT);
        } else if (this.props.type === 'date') {
            if (typeof newValue === 'string') {
                newValue = DateTime.fromISO(newValue);
            }
            newValue = newValue.toFormat(this.DATE_FORMAT);
        } else if (this.props.type === 'integer') {
            newValue = parseInt(newValue) || 0;
        } else if (this.props.type === 'float') {
            newValue = parseFloat(newValue) || 0;
        } else if (this.props.type === 'many2one' || this.props.type === 'many2many') {
            // {id: 5, name: 'Demo'} => [5, 'Demo']
            newValue = (newValue && newValue.length && newValue[0].id)
                ? [newValue[0].id, newValue[0].name]
                : false;

            if (this.props.type === 'many2many' && newValue) {
                // add the record in the current many2many list
                const currentValue = this.props.value || [];
                const recordId = newValue[0];
                const exists = currentValue.find(rec => rec[0] === recordId);
                if (exists) {
                    this.notification.add(
                        _lt('This record is already in the many2many list'),
                        { type: 'warning' },
                    );
                    return;
                }
                newValue = [...currentValue, newValue];
            }
        } else if (this.props.type === 'tags') {
            // add a new tag in the list
            const currentValue = this.props.value || [];
            const exists = currentValue.find(tag => tag[0] === newValue);
            if (exists) {
                this.notification.add(
                    _lt('This tag is already selected'),
                    { type: 'warning' },
                );
                return;
            }
            newValue = [...currentValue, newValue];
        }

        // trigger the onchange event to notify the parent component
        this.props.onChange(newValue);
    }

    onMany2oneClick(ev) {
        if (this.props.readonly) {
            ev.stopPropagation();
            this._openRecord(this.props.model, this.propertyValue[0]);
        }
    }

    onMany2oneEdit() {
        return this.openMany2X({ resId: this.propertyValue[0], context: this.context });
    }

    onMany2manyDelete(many2manyId) {
        console.log('onMany2manyDelete', many2manyId);
        // deep copy
        const currentValue = JSON.parse(JSON.stringify(this.props.value || []));
        const newValue = currentValue.filter((value) => value[0] !== many2manyId);
        this.props.onChange(newValue);
    }

    onTagDelete(tagId) {
        console.log('onTagDelete', tagId);
        const currentValue = JSON.parse(JSON.stringify(this.props.value || []));
        const newValue = currentValue.filter((tag) => tag !== tagId);
        this.props.onChange(newValue);
    }
}

PropertyValue.template = "web.PropertyValue";

PropertyValue.components = {
    Dropdown,
    DropdownItem,
    CheckBox,
    DateTimePicker,
    DatePicker,
    Many2XAutocomplete,
    TagsList,
    AutoComplete,
};

PropertyValue.defaultProps = {
    onChange: () => {},
};

PropertyValue.props = {
    type: { type: String, optional: true },
    model: { type: String, optional: true },
    string: { type: String, optional: true },
    value: { optional: true },
    context: { type: Object },
    readonly: { type: Boolean, optional: true },
    selection: { type: Array, optional: true },
    tags: { type: Array, optional: true },
    onChange: { type: Function, optional: true },
};
