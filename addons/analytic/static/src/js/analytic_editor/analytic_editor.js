/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService, useChildRef } from "@web/core/utils/hooks";
import { getNextTabableElement, getPreviousTabableElement, getTabableElements } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { Field } from "@web/views/fields/field";
import { Many2XAutocomplete, useOpenMany2XRecord, useX2ManyCrud, useAddInlineRecord } from "@web/views/fields/relational_utils";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";
import { Domain } from "@web/core/domain";

const { Component, onPatched, useState, useRef, useExternalListener } = owl;

export class AnalyticEditor extends Component {
    // owl
    setup() {
        console.log('setup');
        console.log(this);

        onPatched(this.patched);

        this.orm = useService("orm");
        this.fetchAllPlans();

        this.state = useState({
            showDropdown: false,
            visited: false,
        });

        this.widgetRef = useRef("analyticEditor");
        this.dropdownRef = useRef("editorDropdown");
        this.mainInputRef = useRef("mainInput");

        usePosition(() => this.widgetRef.el, {
            popper: "editorDropdown",
        });

        this.dropdownHeader = "";

        useExternalListener(window, "click", this.onWindowClick, true);

        this.setMany2OneProps();
        this.autocompleteContainerRef = useChildRef();

        // this.update = (value, params = {}) => {
        //    debugger;
        // };
        const { saveRecord, removeRecord } = useX2ManyCrud(() => this.props.value, false);
        this.addInLine = useAddInlineRecord({
            position: "bottom",
            addNew: (...args) => this.props.value.addNew(...args),
        });
        this.delete = removeRecord;
        // this.update = (recordlist) => {
        //     if (Array.isArray(recordlist)) {
        //         const resIds = recordlist.map((rec) => rec.id);
        //         return saveRecord(resIds);
        //     }
        //     return saveRecord(recordlist);
        // };
    }

    patched() {
        // console.log('patched...');
        // if (this.editingRecord) {
        //     this.focusSomewhere();
        // }
    }

    focusSomewhere() {
        if (this.dropdownOpen) {
            console.log('focusSomewhere');
            let el = this.nextElementToFocus;
            if (el) { el.focus()} else {console.log('no element to focus')};
        }
    }

    // data getters
    getGroupPercentageBalance({ id }) {
        return 100 - Math.min(this.listByGroup({id: id}).reduce((prev, next) => prev + (next.data.percentage || 0), 0), 100);
    }

    get tags() {
        return this.list.map((record) => ({
            id: record.id, // datapoint_X
            text: record.data.display_name ? record.data.display_name : record.data.analytic_account_id[1] + ' ' + record.data.percentage + '%',
            colorIndex: record.data.color,
            group: record.data.group_id,
            onClick: (ev) => {},//(ev) => this.tagClicked({id: record.id}),
            onDelete: this.editingRecord ? () => this.deleteTag(record.id) : undefined,
        }));
    }

    get usedIds() {
        return this.list.filter((record) => !!record.data.acc_id || !!record.data.analytic_account_id).map((record) => record.data.acc_id || record.data.analytic_account_id[0]);
    }

    listByGroup({ id }){
        return this.list.filter((record) => (record.data.group_id && record.data.group_id[0] === id) || record.data.adding_to_group_id[0] == id);
    }

    get list() {
        return this.props.value.records;
    }

    get plans() {
        return this.allPlans;
    }

    // data modifiers
    async setDirty(isDirty) {
        console.log('setDirty', isDirty);
    }

    async updateTag(rec, value, params = {}) {
        console.log('updateTag');
        console.log(this);
        await rec.switchMode("edit");
        await rec.update({
            analytic_account_id: [value[0].id, value[0].name],
            percentage: this.list.length,
        });
        
        let saved = rec.save();
        debugger;
        let unselected = await this.props.value.unselectRecord(true);
        // this.props.value.add(rec.id);
        // this.update(this.props.value.records)
        console.log(unselected);
        console.log(saved);
    }

    async deleteTag(id) {
        console.log('deleteTag ' + id);
        //TODO Fix: deleting an unsaved distribution tag (id virtual_XX) does not work
        const tagRecord = this.list.find((record) => record.id === id);
        const ids = this.props.value.currentIds.filter((id) => id !== tagRecord.data.id);
        await this.props.value.replaceWith(ids);
        console.log(this.props.value);
    }

    async deleteRecord(rec) {
        this.delete(rec);
    }

    async addLineToGroup({id}) {
        console.log('addLineToGroup ', id);
        // this.props.value.addNew({ position: "bottom", context: { default_adding_to_group_id: id }});
        this.addInLine({context: { default_adding_to_group_id: id, default_percentage: this.getGroupPercentageBalance({id: id}) }});
        console.log(this);
    }

    // orm
    async fetchAllPlans() {
        // there is no need to do this for each component instance - consider adding a service - keep in mind groups may change
        let allPlans = await this.orm.call('account.analytic.group', "name_search", [], {});
        this.allPlans = allPlans.map((record) => ({
            id: record[0],
            name: record[1],
        }));
    }

    // prop/state getters
    getMany2OneDomain({ id }) {
        console.log('getMany2OneDomain', id, this.usedIds);
        return new Domain([["group_id", "=", id], ["id", "not in", this.usedIds]]);
    }

    get preventOpen() {
        return this.state.visited;
    }

    get nextElementToFocus() {
        if (this.dropdownOpen) {
            let el = getNextTabableElement(this.dropdownRef.el);
            return el;
        }
        return this.mainInputRef.el;
    }

    get previousElementToFocus() {
        if (this.dropdownOpen) {
            let el = getPreviousTabableElement(this.dropdownRef.el);
            return el;
        }
        return this.mainInputRef.el;
    }

    get dropdownOpen() {
        return this.state.showDropdown;
    }

    get editingRecord() {
        return !this.props.readonly;
    }

    // events
    onWindowClick(ev) {
        if (this.dropdownOpen && this.dropdownRef.el ? !this.dropdownRef.el.contains(ev.target) : false) {
            console.log('window click outside dropdown...closing');
            this.closeAnalyticEditor();
            this.resetVisited();
        }
        // else if (this.editingRecord) {
        //     this.resetVisited();
        // }
    }

    onMainInputFocus(ev) {
        console.log('onMainInputFocus');
        if (!this.preventOpen) {
            this.openAnalyticEditor();
        }
    }

    onMainInputKeydown(ev){
        console.log('onMainInputKeydown');
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "arrowleft": {
                console.log("left");
                break;
            }
            case "arrowright": {
                console.log("right");
                break;
            }
            case "backspace": {
                console.log("backspace");
                break;
            }
            default:
                return;
        }
        ev.preventDefault();
        ev.stopPropagation();
    }

    onKeydown(ev) {
        console.log('onKeydown');
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "tab": {
                if (this.dropdownOpen) {
                    console.log('caught tab;')
                    let el = this.nextElementToFocus;
                    if (el) {
                        el.focus();
                        break;
                    } else {
                        this.closeAnalyticEditor();
                    }
                };
                this.resetVisited();
                return;
            }
            case "shift+tab": {
                if (this.dropdownOpen) {
                    console.log('caught shift+tab;')
                    let el = this.previousElementToFocus;
                    if (el) {
                        el.focus();
                        break;
                    } else {
                        this.closeAnalyticEditor();
                    }
                };
                this.resetVisited();
                return;
            }
            case "escape": {
                if (this.dropdownOpen) {
                    this.forceCloseAnalyticEditor();
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

    // actions
    // setMany2OneFloating(bool) {
    //     console.log('setMany2OneFloating ' + bool);
    // }

    setMany2OneProps() {
        this.many2OnePlaceholder = this.env._t("Search Analytic Accounts");
        this.many2OneModel = "account.analytic.account";
        this.many2OneFieldString = "AnalyticAcc"
        this.many2OneActiveActions = {
            canCreate: false,
            canCreateEdit: false,
            canWrite: false,
        };
    }

    focusMainInputNoActivation () {
        this.state.visited = true;
        this.mainInputRef.el.focus();
    }

    resetVisited() {
        console.log('resetVisited');
        this.state.visited = false;
    }

    openAnalyticEditor() {
        console.log('openAnalyticEditor');
        this.state.showDropdown = true;
        this.resetVisited();
    }

    closeAnalyticEditor() {
        console.log('closeAnalyticEditor');
        this.state.showDropdown = false;
    }

    forceCloseAnalyticEditor() {
        this.closeAnalyticEditor();
        this.focusMainInputNoActivation();
    }
}

AnalyticEditor.template = "analytic_editor";
AnalyticEditor.supportedTypes = ["one2many"];
AnalyticEditor.props = {
    ...standardFieldProps,
    search_field: { type: String, optional: true },
    template_field: { type: String, optional: true },
}
AnalyticEditor.components = { 
    // Many2XAutocomplete,
    Field,
    TagsList,
};
AnalyticEditor.fieldsToFetch = {
    display_name: { name: "display_name", type: "char" }, //used
    percentage: { name: "percentage", type: "float" },
    color: { name: "color", type: "integer" }, //used
    // analytic_account_id: { name: 'analytic_account_id', type: "many2one" },
    acc_id: { name: "acc_id", type: "integer" },
    acc_name: { name: "acc_name", type: "char" },
    group_id: { name: "group_id", type: "many2one" }, //used
    group_name: { name: "group_name", type: "char" },
    adding_to_group_id: { name: "adding_to_group_id", type: "many2one" },
};

AnalyticEditor.extractProps = (fieldName, record, attrs) => {
    return {
        search_field: attrs.options.search_field || null,
        template_field: attrs.options.template_field || null,
    };
};

registry.category("fields").add("analytic_editor", AnalyticEditor);
