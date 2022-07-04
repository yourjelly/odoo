/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { getNextTabableElement, getPreviousTabableElement, getTabableElements } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";

const { Component, useState, useRef, useExternalListener } = owl;


export class AnalyticJson extends Component {
    setup(){
        console.log('Analytic Json', this);
        this.state = useState({
            showDropdown: false,
            list: [],
            addingGroup: false,
        });
        this.orm = useService("orm");
        this.fetchAllPlans();

        this.widgetRef = useRef("analyticJson");
        this.dropdownRef = useRef("analyticDropdown");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticDropdown",
        });

        this.nextId = 0;

        useExternalListener(window, "click", this.onWindowClick, true);
    }

    async fetchAllPlans() {
        // there is no need to do this for each component instance - consider adding a service - keep in mind groups may change
        let allPlans = await this.orm.call('account.analytic.group', "search_read", [], {fields: ["id", "name", "color"]});
        this.allPlans = allPlans.map((record) => ({
            id: record.id,
            name: record.name,
            color: record.color,
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

    async getAnalyticAccountInfo(id) {
        let data = await this.orm.call("account.analytic.account", "read", [id], {fields:["name", "group_id"]})
    }

    async onSelect(option, params) {
        let selected_option = Object.getPrototypeOf(option);
        let tag_id = parseInt(params.input.id);
        let record = this.listItemByID(tag_id);
        if (record) {
            record.analytic_account_id = selected_option.value;
            record.analytic_account_name = selected_option.label;
            record.color = this.planById(selected_option.group_id).color;
        } else {
            console.log('record not found', option, tag_id);
        }
    }

    get plans() {
        return this.allPlans;
    }

    planById(id) {
        return this.plans.filter((plan) => plan.id === id)[0];
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

    get existingAnalyticAccountIDs() {
        return this.listWithAnalyticID.map((dist_tag) => dist_tag.analytic_account_id);
    }

    get listWithAnalyticID() {
        return this.list.filter((dist_tag) => Number.isInteger(dist_tag.analytic_account_id));
    }

    listItemByID(id) {
        return this.list.filter((dist_tag) => dist_tag.id === id)[0];
    }

    get listReady() {
        return this.list.filter((dist_tag) => !!dist_tag.analytic_account_id && dist_tag.percentage > 0);
    }

    get list() {
        return this.state.list;
        // return this.props.value || [];
    }

    listByGroup(id) {
        return this.list.filter((dist_tag) => (dist_tag.group_id === id));
    }

    sumByGroup(id) {
        return this.listByGroup(id).reduce((prev, next) => prev + (parseInt(next.percentage) || 0), 0);;
    }

    remainderByGroup(id) {
        return 100 - Math.min(this.sumByGroup(id), 100);
    }

    autoFill() {
        for (let group of this.plans){
            if (this.remainderByGroup(group.id)) {
                this.addLineToGroup(group.id);
            }
        }
    }

    cleanUp() {
        this.state.list = this.list.filter((dist_tag) => dist_tag.analytic_account_id !== null && dist_tag.percentage > 0 && dist_tag.percentage <= 100);
    }

    deleteTag(id) {
        this.state.list = this.list.filter((dist_tag) => dist_tag.id != id);
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

    newTag(group_id) {
        return {
            id: this.nextId++,
            group_id: group_id,
            analytic_account_id: null,
            analytic_account_name: "",
            percentage: this.remainderByGroup(group_id),
            color: 0,
        }
    }

    addLineToGroup(id) {
        this.state.list.push(this.newTag(id));
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
                    }
                    this.closeAnalyticEditor();
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
        if (this.isDropdownOpen && !this.dropdownRef.el.contains(ev.target)) {
            console.log('window click outside dropdown...closing');
            this.closeAnalyticEditor();
        }
    }

    forceCloseEditor() {
        // this is used when focus will remain/return to the main Element but the dropdown should not open
        this.recentlyClosed = true;
        this.closeAnalyticEditor();
    }

    closeAnalyticEditor() {
        this.cleanUp();
        this.state.showDropdown = false;
    }

    openAnalyticEditor() {
        this.autoFill();
        this.state.showDropdown = true;
    }
}
AnalyticJson.template = "analytic_json";
AnalyticJson.supportedTypes = ["char", "binary"];
AnalyticJson.components = {
    AutoComplete,
    TagsList,
}
AnalyticJson.props = {
    ...standardFieldProps,
}

registry.category("fields").add("analytic_json", AnalyticJson);
