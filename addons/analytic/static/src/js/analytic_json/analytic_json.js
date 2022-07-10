/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { getNextTabableElement, getPreviousTabableElement, getTabableElements } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";

const { Component, useState, useRef, useExternalListener, onWillUpdateProps, onWillStart, onPatched } = owl;


export class AnalyticJson extends Component {
    setup(){
        console.log('Analytic Json', this);
        this.orm = useService("orm");

        this.state = useState({
            showDropdown: false,
            list: {},
            addingGroup: false,
        });

        this.widgetRef = useRef("analyticJson");
        this.dropdownRef = useRef("analyticDropdown");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticDropdown",
        });

        this.nextId = 1;
        onWillStart(this.fetchData);
        onWillUpdateProps(this.jsonToList);

        this.keepFocusInPlan = false;

        onPatched(this.patched);
        useExternalListener(window, "click", this.onWindowClick, true);
    }

    // tryToClose() {
    //     if (this.isDropdownOpen && this.state.closing){
    //         this.state.closing = false;
    //         if (!this.firstIncompletePlanId) {
    //             this.closeAnalyticEditor();
    //         } else {
    //             this.focusIncomplete();
    //         }
    //     }
    // }

    patched() {
        console.log('patched readonly:', this.props.readonly, 'dropdownOpen:', this.isDropdownOpen, 'firstIncompletePlanId:', this.firstIncompletePlanId);
        this.focusIncomplete();
    }

    focusIncomplete() {
        if (this.editingRecord && this.isDropdownOpen) {
            let incompletePlanId = this.keepFocusInPlan || this.firstIncompletePlanId;
            if (incompletePlanId) {
                let incompletePlanSelector = "#plan_" + incompletePlanId + " .incomplete";
                let incompleteEl = this.dropdownRef.el.querySelector(incompletePlanSelector);
                if (!!incompleteEl) this.focus(this.adjacentElementToFocus("next", incompleteEl));
            }
        }
    }

    async fetchData() {
        await this.fetchAllPlans();
        await this.jsonToList(this.props);
    }

    async fetchAllPlans() {
        // there is no need to do this for each component instance - consider adding a service - keep in mind groups may change
        const applicability = ['mandatory', 'optional'];
        let allPlans = await this.orm.call('account.analytic.group', "search_read", [], {fields: ["id", "name", "color"]});
        this.allPlans = allPlans.map((record) => ({
            id: record.id,
            name: record.name,
            color: record.color,
            applicability: applicability[Math.floor(Math.random() * applicability.length)],
        }));
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
        let domain = [['id', 'not in', this.existingAnalyticAccountIDs], ['group_id', '!=', false]];
        if (this.state.addingGroup) {
            // this should be root group id
            domain.push(['group_id', '=', this.state.addingGroup]);
        }
        const records = await this.orm.call("account.analytic.account", "search_read", [], {
            domain: [...domain, ["name", "ilike", request]],
            fields: ["id", "name", "group_id"],
            limit: 7,
            context: [],
        });
        options = records.map((result) => ({
            value: result.id,
            label: result.name,
            group_id: result.group_id[0],
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

    groupAutocompleteFocus(group_id) {
        this.state.addingGroup = group_id;
    }

    async onSelect(option, params, tag) {
        let selected_option = Object.getPrototypeOf(option);
        tag.analytic_account_id = parseInt(selected_option.value);
        tag.analytic_account_name = selected_option.label;
        this.keepFocusInPlan = selected_option.group_id;
    }

    get plans() {
        return this.allPlans;
    }

    get tags() {
        return this.listReady.map((dist_tag) => ({
            id: dist_tag.id,
            text: dist_tag.analytic_account_name + (dist_tag.percentage === 100 ? "" : " " + dist_tag.percentage + "%"),
            colorIndex: dist_tag.color,
            group_id: dist_tag.group_id,
            onDelete: this.editingRecord ? () => this.deleteTag(dist_tag.id) : undefined
        }));
    }

    get listForJson() {
        let res = {};
        this.listReady.map(({analytic_account_id, percentage}) => {
            res[parseInt(analytic_account_id)] = percentage;
        });
        return res;
    }

    async jsonToList(nextProps) {
        
        let data = JSON.parse(nextProps.value || "{}");
        let analytic_account_ids = Object.keys(data);
        const records = await this.orm.call("account.analytic.account", "search_read", [], {
            domain: [["id", "in", analytic_account_ids]],
            fields: ["id", "name", "group_id"],
            context: [],
        });

        if (records.length < data.length) {
            console.log('removing tags.... value should be updated?');
        }

        let res = Object.assign({}, ...this.plans.map((plan) => ({[plan.id]: {...plan, distribution: []}})));
        records.map((record) => {
            res[record.group_id[0]].distribution.push({
                analytic_account_id: record.id,
                percentage: data[record.id],
                id: this.nextId++,
                group_id: record.group_id[0],
                analytic_account_name: record.name,
                color: res[record.group_id[0]].color,
            });
        });

        this.state.list = res;
    }

    newTag(group_id) {
        return {
            id: this.nextId++,
            group_id: group_id,
            analytic_account_id: null,
            analytic_account_name: "",
            percentage: this.remainderByGroup(group_id),
            color: this.state.list[group_id].color,
        }
    }

    tagIsReady({analytic_account_id, percentage}) {
        return !!analytic_account_id && !!percentage;
    }

    addLineToGroup(id) {
        if (this.list[id].distribution.length === this.listReadyByGroup(id).length) {
            this.state.list[id].distribution.push(this.newTag(id));
        }
    }

    autoFill() {
        for (let group of this.plans){
            if (this.remainderByGroup(group.id)) {
                console.log('autoFill adding lines');
                this.addLineToGroup(group.id);
            }
        }
    }

    cleanUp() {
        for (let group_id in this.list){
            this.list[group_id].distribution = this.listReadyByGroup(group_id);
        }
    }

    validate() {
        for (let group_id in this.list) {
            if (this.groupStatus(group_id) === 'red') {
                this.props.invalidate();
                console.log('invalidate called because ', group_id, ' is ', this.groupStatus(group_id));
                return false;
            }
        }
        return true;
    }

    get firstIncompletePlanId() {
        for (let group_id in this.list) {
            let group_status = this.groupStatus(group_id);
            if (["orange", "red", "grey"].includes(group_status)) return group_id;
        }
        return 0;
    }

    async save() {
        console.log('saving locally')
        await this.props.update(JSON.stringify(this.listForJson));
        this.validate();
    }

    get existingAnalyticAccountIDs() {
        return this.listFlat.filter((i) => !!i.analytic_account_id).map((i) => i.analytic_account_id);
    }

    get listReady() {
        return this.listFlat.filter((dist_tag) => this.tagIsReady(dist_tag));
    }

    get listFlat() {
        return Object.values(this.list).flatMap((g) => g.distribution);
    }

    get list() {
        return this.state.list;
    }

    groupStatus(id) {
        let group = this.list[id];
        let ready_tags = this.listReadyByGroup(id);
        if (group.distribution.length > ready_tags.length) {
            if (group.applicability === 'mandatory') return 'orange'
            return 'gray';
        }
        let sum = this.sumByGroup(id);
        if (sum > 100) {
            return 'red';
        }
        if (group.applicability === 'mandatory' && sum < 100){
            return 'red';
        }
        return 'green';
    }

    listReadyByGroup(id) {
        let ready = this.list[id].distribution.filter((tag) => this.tagIsReady(tag));
        return ready;
    }

    sumByGroup(id) {
        return this.list[id].distribution.reduce((prev, next) => prev + (parseFloat(next.percentage) || 0), 0);;
    }

    remainderByGroup(id) {
        return 100 - Math.min(this.sumByGroup(id), 100);
    }

    deleteTag(id) {
        for (let group_id in this.list) {
            this.list[group_id].distribution = this.list[group_id].distribution.filter((dist_tag) => dist_tag.id != id);
        }
        if (!this.isDropdownOpen){
            this.save();
        }
    }

    get editingRecord() {
        return !this.props.readonly;
    }

    get isDropdownOpen() {
        return this.state.showDropdown;
    }

    resetRecentlyClosed() {
        this.recentlyClosed = false;
    }

    onMainElementFocus(ev) {
        if (!this.isDropdownOpen && !this.recentlyClosed) {
            this.openAnalyticEditor();
        }
    }

    adjacentElementToFocus(direction, el = null) {
        if (!this.isDropdownOpen) {
            return null;
        }
        if (!el) {
            el = this.dropdownRef.el;
        }
        return direction == "next" ? getNextTabableElement(el) : getPreviousTabableElement(el);
    }

    focusAdjacent(direction) {
        let elementToFocus = this.adjacentElementToFocus(direction);
        if (elementToFocus){
            this.focus(elementToFocus);
            return true;
        }
        return false;
    }

    focus(el) {
        el.focus();
        if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
            if (el.selectionStart) {
                //bad
                el.selectionStart = 0;
                el.selectionEnd = el.value.length;
            }
            el.select();
        }
    }

    onWidgetKeydown(ev) {
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "tab": {
                if (this.isDropdownOpen) {
                    if (this.focusAdjacent("next")){
                        break;
                    } else {
                        this.closeAnalyticEditor();
                    }
                };
                this.resetRecentlyClosed();
                return;
            }
            case "shift+tab": {
                if (this.isDropdownOpen) {
                    if (this.focusAdjacent("previous")){
                        break;
                    }
                    this.closeAnalyticEditor();
                };
                this.resetRecentlyClosed();
                return;
            }
            case "escape": {
                if (this.isDropdownOpen) {
                    this.forceCloseEditor();
                    break;
                }
                return;
            }
            default: {
                console.log('ignoring', hotkey);
                return;
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    }

    onWindowClick(ev) {
        // review this
        if (!this.widgetRef.el.contains(ev.target) && this.recentlyClosed) {
            this.resetRecentlyClosed(); // in case the click happened after pressing escape (like tab/ shift+tab)
        }
        if (this.isDropdownOpen && this.dropdownRef.el && !this.dropdownRef.el.contains(ev.target)) {
            console.log('window click outside dropdown...closing');
            this.closeAnalyticEditor();
        }
    }

    async percentageChanged(dist_tag, ev) {
        console.log('percentageChanged');
        dist_tag.percentage = parseFloat(ev.target.value);
        if (!this.remainderByGroup(dist_tag.group_id)) this.keepFocusInPlan = false;
        this.autoFill();
    }

    forceCloseEditor() {
        // this is used when focus will remain/return to the main Element but the dropdown should not open
        this.recentlyClosed = true;
        this.closeAnalyticEditor();
    }

    closeAnalyticEditor() {
        this.cleanUp();
        this.save();
        this.state.showDropdown = false;
    }

    openAnalyticEditor() {
        this.keepFocusInPlan = false;
        this.autoFill();
        this.state.showDropdown = true;
    }
}
AnalyticJson.template = "analytic_json";
AnalyticJson.supportedTypes = ["char", "text"];
AnalyticJson.components = {
    AutoComplete,
    TagsList,
}
AnalyticJson.props = {
    ...standardFieldProps,
    invalidate: { type: Function, optional: true },
}
AnalyticJson.defaultProps = {
    invalidate: () => {},
};
AnalyticJson.extractProps = (fieldName, record, attrs) => {
    return {
        invalidate: () => record.setInvalidField(fieldName),
    };
};

registry.category("fields").add("analytic_json", AnalyticJson);
