/** @odoo-module **/

import { Component, useState, useRef } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { _lt } from "@web/core/l10n/translation";
import { useDebounced } from "@web/core/utils/timing";
import { scrollTo } from "@web/core/utils/scrolling";

export class AdvancedSelect extends Component {
    setup() {
        this.nextGroupId = 0;
        this.nextOptionId = 0;

        this.state = useState({ groups: [] });
        this.inputRef = useRef("inputRef");
        this.debouncedOnInput = useDebounced(this.onInput, 250);
    }

    onOpened(scrollContainer) {
        if (this.inputRef.el) {
            this.inputRef.el.focus();
        }

        if (scrollContainer) {
            const element = scrollContainer.querySelector(".o_select_active");
            if (element) {
                scrollTo(element, { scrollable: scrollContainer });
            }
        }
    }

    isOptionSelected(option) {
        return this.props.value === option.value;
    }

    getDropdownItemClass(option) {
        return ("o_select_item px-0 " +
            (this.isOptionSelected(option)
                ? "o_select_active bg-light text-primary fw-bolder fst-italic"
                : "")
        );
    }

    // ======================== Data conversion ========================

    loadGroups(inputString) {
        const groups = [];
        for (const pGroup of this.props.groups) {
            const group = this.makeGroup(pGroup);
            const options = this.loadOptions(pGroup.options, inputString);
            group.options = options.map((option) => this.makeOption(option));
            groups.push(group);
        }
        this.state.groups = groups;
    }

    makeGroup(group) {
        return {
            id: ++this.nextGroupId,
            options: [],
            label: group.label,
            optionTemplate: group.optionTemplate,
        };
    }

    makeOption(option) {
        const label = typeof option == "object" && option.label ? option.label : option;
        const value = typeof option == "object" && option.value ? option.value : option;
        return { id: ++this.nextOptionId, label, value };
    }

    loadOptions(options, request) {
        return typeof options === "function" ? options(request) : options;
    }

    // ======================== Events Handling ========================

    onInput() {
        const inputString = this.inputRef.el.value.trim();
        this.loadGroups(inputString);
    }

    onClear() {
        if (this.props.onClear) {
            this.props.onClear();
        }
    }
}

AdvancedSelect.template = "web.AdvancedSelect";
AdvancedSelect.components = { Dropdown, DropdownItem };
AdvancedSelect.defaultProps = {
    value: undefined,
    togglerClass: "",
    onSelect: (option) => { },
    onClear: () => { },
    canClear: undefined,
    searchable: false,
    searchPlaceholder: _lt("Search..."),
};
AdvancedSelect.props = {
    groups: {
        type: Array,
        element: {
            type: Object,
            shape: {
                options: [Array, Function],
                label: { type: String, optional: true },
                optionTemplate: { type: String, optional: true },
            },
        },
    },
    value: { optional: true },
    class: { type: String, optional: true },
    togglerClass: { type: String, optional: true },
    onSelect: { type: Function, optional: true },
    onClear: { type: Function, optional: true },
    canClear: { type: Boolean, optional: true },
    searchable: { type: Boolean, optional: true },
    searchPlaceholder: { type: String, optional: true },
    slots: { type: Object, optional: true },
};
