/** @odoo-module **/

import { Component, useState, useRef } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { _lt } from "@web/core/l10n/translation";
import { useDebounced } from "@web/core/utils/timing";
import { scrollTo } from "@web/core/utils/scrolling";
import { useAutofocus } from "../utils/hooks";

export class Select extends Component {
    setup() {
        this.nextSourceId = 0;
        this.nextOptionId = 0;
        this.options = new Map();

        this.state = useState({ sources: [] });
        this.inputRef = useRef("inputRef");
        this.debouncedLoadSources = useDebounced(this.loadSources, this.constructor.timeout);

        this.validate();
        this.clearSearch();
        useAutofocus({ refName: "inputRef" });
    }

    validate() {
        if (!odoo.debug) {
            return;
        }

        if (this.props.sources && this.props.options) {
            console.warn(
                "Component 'Select': Both 'sources' and 'options' props are set but only one should be."
            );
        }
    }

    get shouldUseCustom() {
        return (
            this.props.forceCustom ||
            this.props.slots ||
            this.props.searchable ||
            this.props.canDelete !== undefined
        );
    }

    clearSearch(container) {
        if (this.inputRef.el) {
            this.inputRef.el.value = "";
        }
        this.debouncedLoadSources("");
        this.scrollToValue(container);
    }

    scrollToValue(container) {
        if (container) {
            const element = container.querySelector(".o_select_active");
            if (element) {
                scrollTo(element, { scrollable: container });
            }
        }
    }

    isOptionSelected(option) {
        return this.props.value === option.value;
    }

    getDropdownItemClass(option) {
        return (
            "o_select_item px-0 " +
            (this.isOptionSelected(option)
                ? "o_select_active bg-light text-primary fw-bolder fst-italic"
                : "")
        );
    }

    // ======================== Data conversion ========================

    loadSources(inputString) {
        const pSources = this.props.sources
            ? this.props.sources
            : [{ options: this.props.options }];

        this.options = new Map();
        const sources = [];
        for (const pSource of pSources) {
            const source = this.makeSource(pSource);
            const options = this.loadOptions(pSource.options, inputString);
            source.options = options.map((option) => this.makeOption(option));
            sources.push(source);

            for (const option of source.options) {
                this.options.set(option.id, option);
            }
        }

        this.state.sources = sources;
    }

    makeSource(source) {
        return {
            id: ++this.nextSourceId,
            options: [],
            label: source.label,
            optionTemplate: source.optionTemplate,
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

    nativeOnChange(event) {
        const option = this.options.get(parseInt(event.target.value));
        if (typeof option === "object" && option.value) {
            this.props.onSelect(option.value);
        }
    }

    onInput() {
        const inputString = this.inputRef.el.value.trim();
        this.debouncedLoadSources(inputString);
    }

    onDelete(event) {
        event.stopPropagation();
        if (this.props.onDelete) {
            this.props.onDelete();
        }
    }
}

Select.template = "web.Select";
Select.timeout = 250;
Select.components = { Dropdown, DropdownItem };
Select.defaultProps = {
    sources: undefined,
    options: undefined,
    name: "",
    value: undefined,
    canDelete: undefined,
    searchable: false,
    placeholder: false,
    forceCustom: false,
    searchPlaceholder: _lt("Search..."),
    togglerClass: "",
};
Select.props = {
    sources: {
        type: Array,
        optional: true,
        element: {
            type: Object,
            shape: {
                options: [Array, Function],
                label: { type: String, optional: true },
                optionTemplate: { type: String, optional: true },
            },
        },
    },
    options: {
        type: [Array, Function],
        optional: true,
        element: {
            type: [Object, String],
        },
    },
    value: { optional: true },
    class: { type: String, optional: true },
    togglerClass: { type: String, optional: true },
    name: { type: String, optional: true },
    placeholder: { type: String, optional: true },
    onSelect: { type: Function, optional: true },
    onDelete: { type: Function, optional: true },
    canDelete: { type: Boolean, optional: true },
    searchable: { type: Boolean, optional: true },
    searchPlaceholder: { type: String, optional: true },
    forceCustom: { type: Boolean, optional: true },
    slots: { type: Object, optional: true },
};
