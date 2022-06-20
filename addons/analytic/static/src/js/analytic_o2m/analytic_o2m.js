/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/fields/standard_field_props";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { TagsList } from "@web/fields/many2many_tags/tags_list";
import { useService, useOwnedDialogs } from "@web/core/utils/hooks";
import { usePosition } from "@web/core/position_hook";
// import { ListArchParser } from "@web/views/list/list_arch_parser";
// import { ListRenderer } from "@web/views/list/list_renderer";
import {
    useActiveActions,
    useAddInlineRecord,
    useOpenMany2XRecord,
    useSelectCreate,
    useX2ManyCrud,
} from "@web/fields/relational_utils";

const { Component, useState, useRef } = owl;


export class AnalyticO2M extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({
            autocompleteValue: "",
            isOpened: false,
            addingGroup: "",
            autocompleteValue2: "",
        });
        this.widgetRef = useRef("analyticO2m");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticPop",
        });
        // console.log('AnalyticO2m props:');
        // console.log(this.props);
        const { saveRecord, updateRecord, removeRecord } = useX2ManyCrud(
            () => this.props.value,
            false
        );
        this.updateRecord = updateRecord;
        this.openTemplate = useOpenMany2XRecord({
            resModel: this.template_field.relation,
            activeActions: {
                canCreate: true,
                canCreateEdit: false,
                canWrite: true,
            },
            isToMany: false,
            onRecordSaved: async (record) => {
                // await this.props.record.load();
                // await this.props.update(m2oTupleFromData(record.data));
                // if (this.props.record.model.root.id !== this.props.record.id) {
                //     this.props.record.switchMode("readonly");
                // }
                console.log('New Template Saved');
                console.log(record);
            },
            onClose: () => {},
            fieldString: 'Analytic Distribution Template',
        });
        this.activeField = this.props.record.activeFields[this.props.name];
        // this.fetchTreeArch();
        
    }

    // async fetchTreeArch(){
        
    //     // let rawArch = await this.orm.call(this.activeField.relation, "get_view", [], {view_type: 'tree'});
    //     // This function only needs to execute once - for all the distribution_tag_ids fields
    //     let dtag_view = await useService('view').loadViews({context: {},
    //         resModel: 'account.analytic.distribution.tag',
    //         views: [[false, "tree"]]});
    //     this.treeArch = await new ListArchParser().parse(dtag_view.views.tree.arch, dtag_view.relatedModels, this.activeField.relation);
    //     console.log(this.treeArch);
    // }

    get groups() {
        let groups = this.list.map((record) => {return record.data.group_name});
        return [...new Set(groups)]
    }

    listByGroup(group_name) {
        return this.list.filter((record) => record.data.group_name === group_name);
    }

    get list() {
        return this.props.value.records;
    }

    get tags() {
        return this.list.map((record) => ({
            id: record.id, // datapoint_X
            text: record.data.display_name,
            colorIndex: record.data.color,
            group: record.data.group_name,
            // onClick: (ev) => this.onBadgeClick(ev, record),
            onDelete: !this.props.readonly ? () => this.deleteTag(record.id) : undefined,
        }));
    }

    deleteTag(id) {
        const tagRecord = this.list.find((record) => record.id === id);
        const ids = this.props.value.currentIds.filter((id) => id !== tagRecord.resId);
        this.props.value.replaceWith(ids);
    }

    async fetchAllGroups() {
        const groups = await this.orm.call('analytic.account.group', "name_search", [], {
            name: request,
            operator: "ilike",
            args: [],
            limit: 7,
            context: [],
        });
        console.log(groups);
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

        if (!options.length) {
            // if no template are found - search analytic account (can use this to modify the selected template)
            const records = await this.orm.call(this.search_field.relation, "name_search", [], {
                name: request,
                operator: "ilike",
                args: [], //add domain to exclude existing analytic accounts
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

    get sourcesAnalyticAccount() {
        return [this.optionsSourceAnalytic];
    }
    get optionsSourceAnalytic() {
        return {
            placeholder: this.env._t("Loading..."),
            options: this.loadOptionsSourceAnalytic.bind(this),
        };
    }

    async loadOptionsSourceAnalytic(request) {
        let options = [];
        console.log('loadOptionsSourceAnalytic');
        // let group = console.log(this.state.addingGroup);
        let existing_tags = this.listByGroup(this.state.addingGroup);

        const records = await this.orm.call(this.search_field.relation, "name_search", [], {
            name: request,
            operator: "ilike",
            args: [], //add domain to exclude existing analytic accounts
            limit: 7,
            context: [],
        });
        options = records.map((result) => ({
            value: result[0],
            label: result[1],
            field_to_update: this.search_field.name,
        }));
        

        if (!options.length) {
            options.push({
                label: this.env._t("No Analytic Accounts for this plan"),
                classList: "o_m2o_no_result",
                unselectable: true,
            });
        }

        return options;
    }

    stopPropagation(ev){
        // debugger;
        console.log('stopping propagation');
        ev.stopPropagation();
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
        this.state.autocompleteValue = inputValue;
        this.computeIsOpened();
    }

    async onSelect(option, params) {
        console.log('OnSelect');
        console.log(option);
        let selected_option = Object.getPrototypeOf(option)
        let changes = {};
        changes[selected_option.field_to_update] = [selected_option.value, selected_option.label];
        await this.props.record.update(changes);
        this.state.autocompleteValue = "";
        this.computeIsOpened();
        this.state.addingGroup = "";
    }

    get shouldShowEditorDropdown() {
        console.log('should show editor?');
        console.log(this.state.autocompleteValue);
        console.log(!this.props.readonly && !this.state.autocompleteValue.length && !!this.tags.length && this.widgetRef.el.contains(document.activeElement));
        return !this.props.readonly && !this.state.autocompleteValue.length && !!this.tags.length && this.widgetRef.el.contains(document.activeElement);
    }

    computeIsOpened() {
        this.state.isOpened = this.shouldShowEditorDropdown;
    }

    // onAutocompleteBlur() {
    //     this.state.isOpened = this.shouldShowEditorDropdown;
    // }

    focusInput() {

    }

    // blurInput() {
    //     this.state.isOpened = this.shouldShowEditorDropdown;
    // }

    forceDropdownClose() {
        console.log('forceDropdownClose');
        this.state.isOpened = false;
    }

    async percentage_changed(record, ev, obj) {
        console.log('percentage changed');
       
        await record.update({
            analytic_account_id: [record.data.acc_id, "whatever"],
            percentage: ev.target.value,
        });
        // this.props.value.unselectRecord(true);
        // await this.updateRecord(record);
        // console.log(this);
        await record.save()
        // await record.save({savePoint: true});
        // await obj.props.record.save({savePoint: true});
        // debugger;
        // this.record.save();
    }

    async switchMode(record, mode){
        console.log('switch mode doing nothing');
        console.log(record);
        // await record.switchMode(mode);
        console.log(record);
    }

    onOpenExisting() {
        console.log('open existing');
        this.openTemplate({ resId: this.template_field_value[0], context: {} })
    }

    onSaveNew() {
        let tag_context = this.list.map((tag) => {return [0, 0, {
            analytic_account_id: tag.data.analytic_account_id ? tag.data.analytic_account_id.res_id : tag.data.acc_id,
            percentage: tag.data.percentage
        }];});
        console.log('save new');
        console.log(tag_context);
        this.openTemplate({ resId: false, context: {'default_distribution_tag_ids': tag_context} })
    }

    async onClear() {
        console.log('onClear');
        this.props.value.replaceWith([])
        let changes = {};
        changes[this.template_field.name] = false;
        await this.props.record.update(changes);
        this.computeIsOpened();
    }

    async onRandom() {
        for (let [key, value] of Object.entries(this.props.value.records)) {
            value.data.percentage = Math.floor(Math.random() * 100);
            // this.updateRecord(this.props.value.records[key]);
        }
        
    }

    addLine(group){
        this.state.addingGroup = group;
    }
    addingBlur() {
        //this.state.addingGroup = "";
    }


    // rendererProps(group) {
    //     const archInfo = this.treeArch;

    //     let columns = archInfo.columns;
    //     const props = {
    //         activeActions: [],
    //         editable: !this.props.readonly,
    //         archInfo: { ...archInfo, columns },
    //         list: this.props.value,//this.listByGroup(group),
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
    analytic_account_id: { name: 'analytic_account_id', type: "many2one"},
    acc_id: { name: "acc_id", type: "integer" },
    group_name: { name: "group_name", type: "char"},
};

AnalyticO2M.extractProps = (fieldName, record, attrs) => {
    return {
        search_field: attrs.options.search_field || null,
        template_field: attrs.options.template_field || null,
    };
};

registry.category("fields").add("analytic_o2m", AnalyticO2M);
