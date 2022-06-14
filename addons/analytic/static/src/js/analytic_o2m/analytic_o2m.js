/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/fields/standard_field_props";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { TagsList } from "@web/fields/many2many_tags/tags_list";

const { Component, useState } = owl;


export class AnalyticO2M extends Component {
    setup() {
        this.state = useState({
            autocompleteValue: "",
        })
    }

    get tags() {
        console.log('tags');
        console.log(this.props.value.records);
        return this.props.value.records.map((record) => ({
            id: record.id, // datapoint_X
            text: record.data.display_name,
            colorIndex: record.data.color,
            // onClick: (ev) => this.onBadgeClick(ev, record),
            onDelete: !this.props.readonly ? () => this.deleteTag(record.id) : undefined,
        }));
    }

    deleteTag(id) {
        const tagRecord = this.props.value.records.find((record) => record.id === id);
        const ids = this.props.value.currentIds.filter((id) => id !== tagRecord.resId);
        this.props.value.replaceWith(ids);
    }

    get sources() {
        return [
            {
                options: [
                    { label: "World", source: '1' },
                    { label: "Hello", source: '1' },
                ],
            },
            {
                options: [
                    { label: "List 2 Item 1", source: '2' },
                    { label: "List 2 Item 2", source: '2' },
                ]
            },
        ];
    }

    onChange({ inputValue }) {
        console.log('onChange');
        console.log(inputValue);
    }

    onInput({ inputValue }) {
        console.log('onInput');
        console.log(inputValue);
    }

    onSelect(option, params) {
        console.log('OnSelect');
        console.log(option);
        console.log(params);
    }
}
AnalyticO2M.template = "analytic_o2m";
AnalyticO2M.supportedTypes = ["one2many"];
AnalyticO2M.props = {
    ...standardFieldProps,
}
AnalyticO2M.components = { AutoComplete, TagsList };
AnalyticO2M.fieldsToFetch = {
    display_name: { name: "display_name", type: "char" },
    percentage: { name: "percentage", type: "float" },
    color: { name: "color", type: "integer" },
};

registry.category("fields").add("analytic_o2m", AnalyticO2M);
