/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/fields/standard_field_props";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { TagsList } from "@web/fields/many2many_tags/tags_list";
import { useService } from "@web/core/utils/hooks";
import { usePosition } from "@web/core/position_hook";
//import { ListArchParser } from "@web/views/list/list_arch_parser";
//import { ListRenderer } from "@web/views/list/list_renderer";

const { Component, useState, useRef } = owl;


export class AnalyticO2M extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({
            autocompleteValue: "",
            isOpened: false,
        });
        this.widgetRef = useRef("analyticO2m");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticPop",
        });
        //this.activeField = this.props.record.activeFields[this.props.name];
        //this.fetchTreeArch();
    }

    //failed attempt to load the arch manually - needs models - 
    // async fetchTreeArch(){
    //     let rawArch = await this.orm.call(this.activeField.relation, "get_view", [], {view_type: 'tree'});
    //     this.treeArch = await new ListArchParser().parse(rawArch.arch);
    // }

    get tags() {
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
        return [this.optionsSource];
    }
    get optionsSource() {
        return {
            placeholder: this.env._t("Loading..."),
            options: this.loadOptionsSource.bind(this),
        };
    }

    async loadOptionsSource(request) {
        let options = [];

        // if (!request.length) {
        //     options.push({
        //         label: this.env._t("Start typing..."),
        //         classList: "o_m2o_start_typing",
        //         unselectable: true,
        //     });

        //     return options;
        // }

        if (!this.tags.length) {
            // search for templates only if there are no existing tags
            const records = await this.orm.call(this.template_field.relation, "name_search", [], {
                name: request,
                operator: "ilike",
                args: [],
                limit: 7,
                context: [],
            });
            options = records.map((result) => ({
                value: result[0],
                label: result[1],
                field_to_update: this.template_field.name,
            }));
        }

        if (!options.length) {
            // if no template are found - search analytic account (can use this to modify the selected template)
            const records = await this.orm.call(this.search_field.relation, "name_search", [], {
                name: request,
                operator: "ilike",
                args: [],
                limit: 7,
                context: [],
            });
            options = records.map((result) => ({
                value: result[0],
                label: result[1],
                field_to_update: this.search_field.name,
            }));
        }

        if (!options.length) {
            options.push({
                label: this.env._t("No records"),
                classList: "o_m2o_no_result",
                unselectable: true,
            });
        }

        return options;
    }

    get template_field() {
        return this.props.record.fields[this.props.template_field];
    }

    get template_field_value() {
        return this.props.record.data[this.template_field.name];
    }

    get search_field() {
        return this.props.record.fields[this.props.search_field];
    }

    onChange({ inputValue }) {
        console.log('onChange');
        console.log(inputValue);
    }

    onInput({ inputValue }) {
        console.log('onInput');
        console.log(inputValue);
        if (inputValue.length) {
            this.onWidgetBlur();
        } else { this. onWidgetFocus();}
    }

    async onSelect(option, params) {
        console.log('OnSelect');
        console.log(option);
        let selected_option = Object.getPrototypeOf(option)
        let changes = {};
        changes[selected_option.field_to_update] = [selected_option.value, selected_option.label];
        await this.props.record.update(changes);
        this.onWidgetFocus();
    }

    onWidgetFocus() {
        if (this.tags.length) {
            this.state.isOpened = true;
        }
        console.log(this.props.value);
    }

    onWidgetBlur() {
        if (!this.preventClosePopup) {
            this.state.isOpened = false;
        }
    }

    focusInput() {
        this.preventClosePopup = true;
    }

    blurInput() {
        this.preventClosePopup = false;
    }

    // get rendererProps() {
    //     const archInfo = this.activeField.views[this.activeField.viewMode];

    //     let columns = archInfo.columns;
    //     const props = {
    //         activeActions: [],
    //         editable: !this.props.readonly,
    //         archInfo: { ...archInfo, columns },
    //         list: this.props.value,
    //         openRecord: ()=>{},
    //         onAdd: ()=>{}, //this.onAdd.bind(this),
    //     };

    //     return props;
    // }
}
AnalyticO2M.template = "analytic_o2m";
AnalyticO2M.supportedTypes = ["one2many"];
AnalyticO2M.props = {
    ...standardFieldProps,
    search_field: { type: String, optional: true },
    template_field: { type: String, optional: true },
}
AnalyticO2M.components = { 
    AutoComplete,
    TagsList,
    // ListRenderer 
};
AnalyticO2M.fieldsToFetch = {
    display_name: { name: "display_name", type: "char" },
    percentage: { name: "percentage", type: "float" },
    color: { name: "color", type: "integer" },
    analytic_account_id: { name: 'analytic_account_id', type: "many2one"}
};

AnalyticO2M.extractProps = (fieldName, record, attrs) => {
    return {
        search_field: attrs.options.search_field || null,
        template_field: attrs.options.template_field || null,
    };
};

registry.category("fields").add("analytic_o2m", AnalyticO2M);
