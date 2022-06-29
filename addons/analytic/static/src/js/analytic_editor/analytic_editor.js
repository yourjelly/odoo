/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { getNextTabableElement, getPreviousTabableElement, getTabableElements } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";

import { standardFieldProps } from "@web/views/fields/standard_field_props";

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

        useExternalListener(window, "click", this.onWindowClick, true);
    }

    patched() {
        console.log('patched...');
        if (this.editingRecord) {
            this.focusSomewhere();
        }
    }

    focusSomewhere() {
        if (this.dropdownOpen) {
            console.log('focusSomewhere');
            let el = this.nextElementToFocus;
            if (el) { el.focus()} else {console.log('no element to focus')};
        }
    }

    // data getters
    get plans() {
        return this.allPlans;
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
    get preventOpen() {
        return this.state.visited == true;
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
        console.log('window click');
        if (this.dropdownOpen && this.dropdownRef.el ? !this.dropdownRef.el.contains(ev.target) : false) {
            this.closeAnalyticEditor();
        }
        this.resetVisited();
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
                    this.closeAnalyticEditor();
                    this.focusMainInputNoActivation();
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
}

AnalyticEditor.template = "analytic_editor";
AnalyticEditor.supportedTypes = ["one2many"];
AnalyticEditor.props = {
    ...standardFieldProps,
    search_field: { type: String, optional: true },
    template_field: { type: String, optional: true },
}
AnalyticEditor.components = { 

};
AnalyticEditor.fieldsToFetch = {
    display_name: { name: "display_name", type: "char" },
    percentage: { name: "percentage", type: "float" },
    color: { name: "color", type: "integer" },
    analytic_account_id: { name: 'analytic_account_id', type: "many2one"},
    acc_id: { name: "acc_id", type: "integer" },
    acc_name: { name: "acc_name", type: "char"},
    group_name: { name: "group_name", type: "char"},
};

AnalyticEditor.extractProps = (fieldName, record, attrs) => {
    return {
        search_field: attrs.options.search_field || null,
        template_field: attrs.options.template_field || null,
    };
};

registry.category("fields").add("analytic_editor", AnalyticEditor);
