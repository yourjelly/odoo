/** @odoo-module **/

import { registry } from "@web/core/registry";
import { SelectionField, selectionField } from "@web/views/fields/selection/selection_field";

export class DynamicSelectionField extends SelectionField {

    static props = {
        ...SelectionField.props,
        available_field: { type: String },
    }

    get availableOptions() {
        return this.props.record.data[this.props.available_field]?.split(",") || [];
    }

    /** Override **/
    get options() {
        const availableOptions = this.availableOptions;
        return super.options.filter(x => availableOptions.includes(x[0]));
    }

}

/*
EXAMPLE USAGE:

In python:
the_available_field = fields.Char()  # string of comma separated available selection field keys
the_selection_field = fields.Selection([ ... ])

In the views:
<field name="the_available_field" column_invisible="1"/>
<field name="the_selection_field"
       widget="dynamic_selection"
       options="{'available_field': 'the_available_field'}"/>
 */

registry.category("fields").add("dynamic_selection", {
    ...selectionField,
    component: DynamicSelectionField,
    extractProps: (fieldInfo, dynamicInfo) => ({
        ...selectionField.extractProps(fieldInfo, dynamicInfo),
        available_field: fieldInfo.options.available_field,
    }),
})
