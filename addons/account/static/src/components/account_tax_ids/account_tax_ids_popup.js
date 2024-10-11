import { useService } from "@web/core/utils/hooks";
import { getNextTabableElement, getPreviousTabableElement } from "@web/core/utils/ui";
import { usePosition } from "@web/core/position/position_hook";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { _t } from "@web/core/l10n/translation";
import {
    Component,
    useState,
    useRef,
    useExternalListener,
    onPatched,
} from "@odoo/owl";
import { TagsList } from "@web/core/tags_list/tags_list";

export class AccountTaxPopup extends Component {
    static template = "account.AccountTaxPopup";
    static components = {
        TagsList,
    }
    setup(){
        this.orm = useService("orm");
        this.state = useState({
            showDropdown: true,
            formattedData: [],
        });
        this.widgetRef = useRef("accountTax");
        this.dropdownRef = useRef("accountTaxDropdown");
        this.mainRef = useRef("mainTaxElement");
        this.addLineButton = useRef("addLineButton");
        this.focusSelector = false;
        usePosition("accountTaxDropdown", () => this.widgetRef.el);
        onPatched(this.patched);
        useExternalListener(window, "click", this.onWindowClick, true);
        useExternalListener(window, "resize", this.onWindowResized);
    }
    patched() {
        this.focusToSelector();
    }
    get editingRecord() {
        return !this.props.readonly;
    }
    get isDropdownOpen() {
        return this.state.showDropdown && !!this.dropdownRef.el;
    }
    async save() {
        console.log('done');
    }
    forceCloseEditor() {
        // focus to the main Element but the dropdown should not open
        this.preventOpen = true;
        this.closeAccountTaxPopup();
        this.mainRef.el.focus();
        this.preventOpen = false;
    }
    closeAccountTaxPopup() {
        this.save();
        this.state.showDropdown = false;
    }
    
    focusToSelector() {
        if (this.focusSelector && this.isDropdownOpen) {
            this.focus(this.adjacentElementToFocus("next", this.dropdownRef.el.querySelector(this.focusSelector)));
        }
        this.focusSelector = false;
    }
    setFocusSelector(selector) {
        this.focusSelector = selector;
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
        const elementToFocus = this.adjacentElementToFocus(direction);
        if (elementToFocus){
            this.focus(elementToFocus);
            return true;
        }
        return false;
    }
    focus(el) {
        if (!el) return;
        el.focus();
        if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
            if (el.selectionStart) {
                el.selectionStart = 0;
                el.selectionEnd = el.value.length;
            }
            el.select();
        }
    }
    // Keys and Clicks
    async onWidgetKeydown(ev) {
        if (!this.editingRecord) {
            return;
        }
        const hotkey = getActiveHotkey(ev);
        switch (hotkey) {
            case "enter":
            case "tab": {
                if (this.isDropdownOpen) {
                    const closestCell = ev.target.closest("td, th");
                    const row = closestCell.parentElement;
                    const line = this.state.formattedData[parseInt(row.id)];
                    if (this.adjacentElementToFocus("next") == this.addLineButton.el && line && this.lineIsValid(line)) {
                        this.addLine();
                        break;
                    }
                    this.focusAdjacent("next") || this.forceCloseEditor();
                    break;
                };
                return;
            }
            case "shift+tab": {
                if (this.isDropdownOpen) {
                    this.focusAdjacent("previous") || this.forceCloseEditor();
                    break;
                };
                return;
            }
            case "escape": {
                if (this.isDropdownOpen) {
                    this.forceCloseEditor();
                    break;
                }
            }
            case "arrowdown": {
                if (!this.isDropdownOpen) {
                    this.onMainTaxElementFocus();
                    break;
                }
                return;
            }
            default: {
                return;
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    }
    onWindowClick(ev) {
        /*
        Dropdown should be closed only if all these condition are true:
            - dropdown is open
            - click is outside widget element (widgetRef)
            - there is no active modal containing a list/kanban view (search more modal)
            - there is no popover (click is not in search modal's search bar menu)
            - click is not targeting document dom element (drag and drop search more modal)
        */
        const selectors = [
            ".o_popover",
            ".modal:not(.o_inactive_modal):not(:has(.o_act_window))",
        ];
        if (this.isDropdownOpen
            && !this.widgetRef.el.contains(ev.target)
            && !ev.target.closest(selectors.join(","))
            && !ev.target.isSameNode(document.documentElement)
           ) {
            this.forceCloseEditor();
        }
    }
    onWindowResized() {
        // popup ui is ugly when window is resized, so close it
        if (this.isDropdownOpen) {
            this.forceCloseEditor();
        }
    }
}
