/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";
import { useService, useChildRef } from "@web/core/utils/hooks";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import {
    getNextTabableElement,
    getPreviousTabableElement,
    getTabableElements
} from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";

// import { getNextTabableElement } from "@web/core/utils/ui";
// import { ListArchParser } from "@web/views/list/list_arch_parser";
// import { ListRenderer } from "@web/views/list/list_renderer";
import {
    useActiveActions,
    useAddInlineRecord,
    useOpenMany2XRecord,
    useSelectCreate,
    useX2ManyCrud,
} from "@web/views/fields/relational_utils";

const { Component, useState, useRef, useExternalListener, onPatched } = owl;


export class AnalyticO2M extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({
            autocompleteValue: "",
            isOpened: false,
            addingGroup: "",
            autocompleteValue2: "",
            groups: [],
            clickedTag: false,
        });
        this.widgetRef = useRef("analyticO2m");
        this.dropdownRef = useRef("analyticPop");
        this.groupTableRef = useRef("groupTable");
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
                this.focusCellAutocomplete();
            },
            onClose: () => {
                console.log('form Closed');
                this.focusCellAutocomplete();
            },
            fieldString: 'Analytic Distribution Template',
        });
        this.activeField = this.props.record.activeFields[this.props.name];
        // this.fetchTreeArch();
        this.fetchAllGroups();
        useExternalListener(window, "scroll", this.onWindowScroll, true);
        useExternalListener(window, "click", this.onWindowClick, true);
        onPatched(this.patched);
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

    patched(){
        console.log('onPatched');
        if (!this.props.readonly) {
            if (!this.state.isOpened ){
                this.focusCellAutocomplete();
            }
            else {
                if (!!this.state.addingGroup) {
                    this.focusGroupAutocomplete();
                }
                if (this.state.clickedTag) {
                    this.focusTagPercentage();
                }
            }
        }
    }

    focusTagPercentage() {
        // this.dropdownRef.querySelector(this.state.clickedTag + "_percentage").focus()
        console.log('focusTagPercentage - should focus on:');
        let inputToFocus = this.dropdownRef.el.querySelector('#' + this.state.clickedTag + "_percentage");
        console.log(inputToFocus);
        if (inputToFocus) inputToFocus.focus();
        console.log('document activeElement');
        console.log(document.activeElement);
        // onpatched methods should not update the state as it will trigger onpatched
        // this.state.clickedTag = false;s
    }

    // focusNextPercentage(containerEl = null, nearbyEl = null) {
    //     let container = containerEl ? containerEl : this.groupTableRef.el;
    //     let percentage_inputs = container.querySelectorAll('.o_analytic_percentage');
    //     console.log('focus Next Percentage - found these:');
    //     console.log(percentage_inputs);
    //     if (percentage_inputs.length) {
    //         percentage_inputs[0].focus();
    //     }
    // }

    focusGroupAutocomplete(){
        
        const el = this.groupTableRef.el.querySelector('.o-autocomplete--input');
        console.log('focusgroupAutoComplete' + el);
        if (el) el.focus();
    }

    focusCellAutocomplete(){
        const el = this.widgetRef.el.querySelector('.o-autocomplete--input');
        if (el) el.focus();
    }

    get groups() {
        const groups = this.list.map((record) => {return record.data.group_name});
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
            acc_id: record.data.acc_id,
            onClick: (ev) => this.tagClicked({id: record.id}),
            onDelete: !this.props.readonly ? () => this.deleteTag(record.id) : undefined,
        }));
    }

    tagClicked({id}){
        console.log('clicked tag');
        console.log(id);
        this.state.clickedTag = id;
        this.forceDropdownOpen();
    }

    get_tag_by_acc_id(acc_id) {
        return this.tags.filter((tag) => tag.acc_id == acc_id)[0];
    }

    get tag_ids() {
        return this.list.map((record) => record.data.acc_id);
    }

    async deleteTag(id) {
        const tagRecord = this.list.find((record) => record.id === id);
        const ids = this.props.value.currentIds.filter((id) => id !== tagRecord.resId);
        await this.props.value.replaceWith(ids);
        if (!ids.length) {
            this.forceDropdownClose();
        }
    }

    async fetchAllGroups() {
        if (this.state.groups.length === 0) {
            this.state.groups = await this.orm.call('account.analytic.group', "name_search", [], {});
        }
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
        let records = await this.orm.call(this.template_field.relation, "name_search", [], {
            name: request,
            operator: "ilike",
            args: [],
            limit: 3,
            context: [],
        });
        if (records.length) {
            options.push({
                label: this.env._t("Model Templates"),
                classList: "o_dropdown_bold",
                unselectable: true,
            })
        }
        records.map((result) => (options.push({
            value: result[0],
            label: result[1],
            field_to_update: this.template_field.name,
        })));

        records = await this.orm.call(this.search_field.relation, "name_search", [], {
            name: request,
            operator: "ilike",
            args: [['id', 'not in', this.tag_ids]], //add domain to exclude existing analytic accounts
            limit: 8 - options.length,
            context: [],
        });
        if (records.length) {
            options.push({
                label: this.env._t("Analytic Accounts"),
                classList: "o_dropdown_bold",
                unselectable: true,
            })
        }
        records.map((result) => (options.push({
            value: result[0],
            label: result[1],
            field_to_update: this.search_field.name,
        })));

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
        let existing_tags = this.listByGroup(this.state.addingGroup[1]).map((record) => record.data.acc_id);

        const records = await this.orm.call(this.search_field.relation, "name_search", [], {
            name: request,
            operator: "ilike",
            args: [['group_id', '=', this.state.addingGroup[0]], ['id', 'not in', existing_tags]],
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
        // this.computeIsOpened();
    }

    getNextElement() {
        this.state.clickedTag = false;
        let el = getNextTabableElement(this.dropdownRef.el)
        el = el ? el : getTabableElements(this.dropdownRef.el)[0]
        return el; 
    }

    getPreviousElement() {
        this.state.clickedTag = false;
        let el = getPreviousTabableElement(this.dropdownRef.el)
        el = el ? el : getTabableElements(this.dropdownRef.el).pop()
        return el; 
    }


    onAutoCompleteKeydown(ev) {
        console.log('onAutoCompleteKeydown');
        console.log(ev);
        if (this.props.readonly) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        console.log(hotkey);
        const dropdownOpen = this.state.isOpened;
        const mainAutoCompleteEditing = dropdownOpen ? false : !!this.state.autocompleteValue;
        const hasTags = !!this.tags.length;
        // const activeInput = dropdownOpen ? document.activeElement : false;
        // console.log(activeInput);
        switch (hotkey) {
            case "backspace": {
                if (!dropdownOpen && hasTags) {
                    this.deleteTag(this.tags.pop().id);
                }
                return;
            }
            case "arrowright": {
                if (!mainAutoCompleteEditing && !dropdownOpen && hasTags) this.forceDropdownOpen();
                return;
            }
            case "arrowleft": {
                if (dropdownOpen) this.forceDropdownClose();
                //maybe select a tag so it can be deleted with backspace
                return;
            }
            case "escape": {
                if (dropdownOpen) this.forceDropdownClose();
                break;
            }
            case "tab": {
                if (dropdownOpen) {
                    if (!!this.state.addingGroup) this.cancelAddLine();
                    console.log('should tab to:');
                    this.getNextElement().focus();
                    break;
                }
                return;
            }
            case "shift+tab": {
                if (dropdownOpen) {
                    if (!!this.state.addingGroup) this.cancelAddLine();
                    console.log('should tab back to:');
                    this.getPreviousElement().focus();
                    break;
                }
                return;
            }
            default:
                return;
        }
        ev.preventDefault();
        ev.stopPropagation();
    }

    async onSelect(option, params) {
        console.log('OnSelect');
        console.log(option);
        let selected_option = Object.getPrototypeOf(option)
        let changes = {};
        changes[selected_option.field_to_update] = [selected_option.value, selected_option.label];
        await this.props.record.update(changes);
        this.state.autocompleteValue = "";
        // this.computeIsOpened();
        // this.state.addingGroup = "";
        this.cancelAddLine();
        if (selected_option.field_to_update === this.props.search_field){
            console.log('new analytic tag added - setting the tag clicked to:');
            // this.tagClicked(this.get_tag_by_acc_id(selected_option.value));
            this.state.clickedTag = this.get_tag_by_acc_id(selected_option.value).id;
            console.log(this.state.clickedTag);
        } else {
            this.state.clickedTag = false;
        }
    }

    // get shouldShowEditorDropdown() {
    //     console.log('should show editor?');
    //     console.log(this.state.autocompleteValue);
    //     console.log(!this.props.readonly && !this.state.autocompleteValue.length && !!this.tags.length && this.widgetRef.el.contains(document.activeElement));
    //     return !this.props.readonly && !this.state.autocompleteValue.length && !!this.tags.length && this.widgetRef.el.contains(document.activeElement);
    // }

    // computeIsOpened() {
    //     this.state.isOpened = this.shouldShowEditorDropdown;
    // }

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
        if (this.state.isOpened) {
            this.state.addingGroup = "";
            this.state.clickedTag = false;
            this.state.isOpened = false;
        }
    }

    forceDropdownOpen(){
        if (!this.state.clickedTag) {
            // this.tagClicked(null, this.tags[0]);
            console.log('force dropdown open is defaulting to tag 0');
            // this.tagClicked(this.tags[0])
            this.state.clickedTag = this.tags[0].id;
        }
        if (!this.state.isOpened) this.state.isOpened = true;
    }

    onWindowScroll(ev) {
        if (this.state.isOpened && this.dropdownRef.el ? !this.dropdownRef.el.contains(ev.target) : false) {
            this.forceDropdownClose();
        }
    }

    onWindowClick(ev) {
        console.log('window click');
        // console.log(ev);
        // console.log('isOpened and click not in dropdown' + (this.state.isOpened && this.dropdownRef.el ? !this.dropdownRef.el.contains(ev.target) : false))
        if (this.state.isOpened && this.dropdownRef.el ? !this.dropdownRef.el.contains(ev.target) : false) {
            this.forceDropdownClose();
        }
    }

    async percentage_changed(record, ev, obj) {
        console.log('percentage changed');
        console.log(record);
        await record.update({
            analytic_account_id: [record.data.acc_id, record.data.analytic_account_id ? record.data.analytic_account_id[1] : record.data.display_name],
            percentage: ev.target.value,
        });
        // debugger;
        // this.props.value.unselectRecord(true);
        // await this.updateRecord(record);
        // console.log(this);
        await record.save()
        // record.model.notify()
        // await record.save({savePoint: true});
        // await obj.props.record.save({savePoint: true});
        // debugger;
        // this.record.save();
    }

    // async switchMode(record, mode){
    //     console.log('switch mode doing nothing');
    //     console.log(record);
    //     // await record.switchMode(mode);
    //     console.log(record);
    // }

    selectText(ev){
        // this.state.clickedTag = false;
        ev.target.select();
        // this.cancelAddLine();
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
        // this.computeIsOpened();
        this.forceDropdownClose();
    }

    async onRandom() {
        for (let [key, value] of Object.entries(this.props.value.records)) {
            value.data.percentage = Math.floor(Math.random() * 100);
            // this.updateRecord(this.props.value.records[key]);
        }
        
    }

    // refreshAutocompleteRef() {
    //     this.autocompleteContainerRef = useChildRef();
    //     console.log(this.autocompleteContainerRef);
    //     this.focusInput = () => {
    //         this.autocompleteContainerRef.el.querySelector("input").focus();
    //     };
    // }

    addLine(group, ev){
        this.state.addingGroup = group;
        this.state.clickedTag = false;
        // let nextInput = this.groupTableRef.el.querySelector('.o-autocomplete--input'); //getNextTabableElement(this.groupTableRef.el);
        console.log('addLine');
        console.log(this.state.addingGroup);
        // console.log(nextInput);
        // Can not focus on the input of the new Autocomplete - needs useForwardRefToParent or a custom AutoComplete that does this
        // this.refreshAutocompleteRef();
        // this.focusInput();
    }
    cancelAddLine(ev) {
        this.state.addingGroup = "";
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
    acc_name: { name: "acc_name", type: "char"},
    group_name: { name: "group_name", type: "char"},
};

AnalyticO2M.extractProps = (fieldName, record, attrs) => {
    return {
        search_field: attrs.options.search_field || null,
        template_field: attrs.options.template_field || null,
    };
};

registry.category("fields").add("analytic_o2m", AnalyticO2M);
