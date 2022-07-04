/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";

import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";

const { Component, useState, useRef, useExternalListener } = owl;


export class AnalyticJson extends Component {
    setup(){
        console.log('Analytic Json', this);
        this.state = useState({
            showDropdown: false,
            list: [],
        });
        this.orm = useService("orm");
        this.fetchAllPlans();

        this.widgetRef = useRef("analyticJson");
        this.dropdownRef = useRef("analyticDropdown");
        usePosition(() => this.widgetRef.el, {
            popper: "analyticDropdown",
        });

        useExternalListener(window, "click", this.onWindowClick, true);
    }

    async fetchAllPlans() {
        // there is no need to do this for each component instance - consider adding a service - keep in mind groups may change
        let allPlans = await this.orm.call('account.analytic.group', "name_search", [], {});
        this.allPlans = allPlans.map((record) => ({
            id: record[0],
            name: record[1],
        }));
    }

    get plans() {
        return this.allPlans;
    }

    get tags() {
        return this.list.map((dist_tag) => ({
            id: dist_tag.id,
            text: dist_tag.analytic_account_name + " " + dist_tag.percentage + "%",
            colorIndex: dist_tag.color,
            group_id: dist_tag.group_id,
            onDelete: this.editingRecord ? () => this.deleteTag(dist_tag.id) : undefined
        }));
    }

    get list() {
        return this.state.list;
        // return this.props.value || [];
    }

    listByGroup(id) {
        return this.list.filter((dist_tag) => (dist_tag.group_id === id));
    }

    sumByGroup(id) {
        return this.listByGroup(id).reduce((prev, next) => prev + (next.percentage || 0), 0)
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
            id: this.list.length,
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

    onWidgetKeydown(ev) {
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "tab": {
                if (this.isDropdownOpen) {
                    console.log('caught tab; to focus is not implemented; closing...');
                    this.closeAnalyticEditor();
                };
                this.resetRecentlyClosed();
                return;
            }
            case "shift+tab": {
                if (this.isDropdownOpen) {
                    console.log('caught shift+tab; to focus is not implemented; closing...');
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
    TagsList,
}
AnalyticJson.props = {
    ...standardFieldProps,
}

registry.category("fields").add("analytic_json", AnalyticJson);
