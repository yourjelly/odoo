/** @odoo-module **/

import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { Tag } from "../core/tag";
import { refresh, setParams, subscribeToURLParams } from "../core/url";
import { Object } from "../globals";
import { compactXML, debounce, isRegExpFilter, lookup, title } from "../utils";
import { HootTagButton } from "./hoot_tag_button";

/**
 * @typedef {"suites" | "tags" | "tests"} SearchCategory
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {import("../core/suite").Suite | import("../core/tag").Tag | import("../core/test").Test} item
 */
const getIndex = (item) => item.index;

/**
 * @param {string[]} values
 */
const toObject = (values) => values.reduce((obj, value) => ({ ...obj, [value]: true }), {});

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/** @extends Component<{}, import("../hoot").Environment> */
export class HootSearch extends Component {
    static components = { HootTagButton };

    static template = compactXML/* xml */ `
        <div class="hoot-search hoot-relative" t-ref="root" t-on-keydown="onKeyDown">
            <form class="hoot-search-group hoot-row" t-on-submit.prevent="onSubmit">
                <div class="hoot-search-bar hoot-row hoot-p-1 hoot-gap-1">
                    <t t-foreach="getCategoryCounts()" t-as="count" t-key="count.id">
                        <button
                            type="submit"
                            class="hoot-btn hoot-row hoot-gap-1 hoot-px-1 hoot-p-1"
                            t-att-title="count.text"
                            t-on-click="() => this.uncheckCategory(count.id)"
                        >
                            <i t-attf-class="bi bi-{{ count.icon }}" />
                            <t t-esc="count.value" />
                        </button>
                    </t>
                    <input
                        type="text"
                        class="hoot-p-1"
                        autofocus="autofocus"
                        placeholder="Filter suites, tests or tags"
                        t-ref="search-input"
                        t-model.trim="state.query"
                        t-on-input="onInput"
                    />
                </div>
                <button
                    type="submit"
                    class="hoot-btn-go hoot-btn hoot-p-2 hoot-px-2"
                    t-att-disabled="state.buttonDisabled"
                >
                    Go
                </button>
            </form>
            <t t-if="state.query and state.showDropdown">
                <div class="hoot-dropdown">
                    <div class="hoot-dropdown-category hoot-col">
                        <h5 class="hoot-dropdown-header hoot-row">
                            <span class="hoot-dropdown-title">Filter using <t t-esc="filterType" /></span>
                        </h5>
                        <ul class="hoot-dropdown-lines hoot-col">
                            <li tabindex="0" t-on-keydown="(ev) => this.onLineKeyDown(ev, null)">
                                <button
                                    class="hoot-dropdown-line"
                                    title="Run this filter"
                                    t-on-click="() => this.reload({ useTextFilter: true })"
                                >
                                    "<span t-esc="state.query" />"
                                </button>
                            </li>
                        </ul>
                    </div>
                    <t t-foreach="categories" t-as="category" t-key="category.id">
                        <t t-if="state.categories[category.id].length">
                            <div class="hoot-dropdown-category hoot-col">
                                <h5 class="hoot-dropdown-header hoot-row">
                                    <span class="hoot-dropdown-title" t-esc="title(category.plural)" />
                                    <button
                                        class="hoot-remove-category hoot-text-danger"
                                        t-attf-title="Uncheck all {{ category.plural }}"
                                        t-on-click="() => this.uncheckCategory(category.id)"
                                    >✖</button>
                                </h5>
                                <ul class="hoot-dropdown-lines hoot-col">
                                    <t t-foreach="state.categories[category.id]" t-as="item" t-key="item.id">
                                        <li tabindex="0" t-on-keydown="(ev) => this.onLineKeyDown(ev, category.id, item.id)">
                                            <label
                                                class="hoot-dropdown-line hoot-checkbox"
                                                t-attf-title="Add/remove {{ category.singular }}"
                                            >
                                                <input
                                                    type="checkbox"
                                                    tabindex="-1"
                                                    t-model="state.checked[category.id][item.id]"
                                                />
                                                <t t-if="isTag(item)">
                                                    <HootTagButton tag="item" disabled="true" />
                                                </t>
                                                <span t-else="" t-esc="item.fullName" />
                                            </label>
                                        </li>
                                    </t>
                                </ul>
                            </div>
                        </t>
                    </t>
                </div>
            </t>
        </div>
    `;

    categories = [
        {
            id: "suites",
            singular: "suite",
            plural: "suites",
            icon: "list-check",
        },
        {
            id: "tests",
            singular: "test",
            plural: "tests",
            icon: "braces-asterisk",
        },
        {
            id: "tags",
            singular: "tag",
            plural: "tags",
            icon: "tag-fill",
        },
    ];
    title = title;

    setup() {
        this.rootRef = useRef("root");
        this.searchInputRef = useRef("search-input");
        this.urlParams = subscribeToURLParams();
        this.state = useState({
            query: this.urlParams.filter || "",
            showDropdown: false,
            buttonDisabled: true,
            categories: {
                suites: [],
                tags: [],
                tests: [],
            },
            checked: {
                suites: toObject(this.urlParams.suite || []),
                tags: toObject(this.urlParams.tag || []),
                tests: toObject(this.urlParams.test || []),
            },
        });

        this.updateSuggestions = debounce(() => {
            this.filterType = isRegExpFilter(this.state.query) ? "regular expression" : "text";
            this.state.categories = this.findSuggestions();
            this.state.showDropdown = true;
        }, 16);

        useExternalListener(window, "click", (ev) => {
            this.state.showDropdown = this.rootRef.el?.contains(ev.target);
        });
    }

    findSuggestions() {
        const { runner } = this.env;
        const { query } = this.state;
        return {
            suites: lookup(query, runner.suites, getIndex),
            tests: lookup(query, runner.tests, getIndex),
            tags: lookup(query, runner.tags, getIndex),
        };
    }

    getCategoryCounts() {
        const { checked } = this.state;
        const counts = [];
        for (const { id, icon, plural } of this.categories) {
            const count = Object.values(checked[id]).filter(Boolean).length;
            if (count) {
                counts.push({ id, icon, text: `Remove all ${plural}`, value: count });
            }
        }
        return counts;
    }

    /**
     * @param {unknown} item
     */
    isTag(item) {
        return item instanceof Tag;
    }

    onSubmit() {
        this.reload({
            useTextFilter: document.activeElement === this.searchInputRef.el && this.state.query,
        });
    }

    onInput() {
        this.state.buttonDisabled = !this.state.query || this.state.query === this.urlParams.filter;
        this.updateSuggestions();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        /**
         * @param {number} inc
         */
        const navigate = (inc) => {
            ev.preventDefault();
            const elements = [
                this.searchInputRef.el,
                ...this.rootRef.el.querySelectorAll("[tabindex='0']"),
            ];
            let nextIndex = elements.findIndex((el) => el === document.activeElement) + inc;
            if (nextIndex >= elements.length) {
                nextIndex = 0;
            } else if (nextIndex < -1) {
                nextIndex = -1;
            }
            elements.at(nextIndex).focus();
        };

        switch (ev.key) {
            case "Escape": {
                ev.preventDefault();
                this.state.showDropdown = false;
                return;
            }
            case "ArrowDown": {
                return navigate(+1);
            }
            case "ArrowUp": {
                return navigate(-1);
            }
        }
    }

    onLineKeyDown(ev, category, id) {
        switch (ev.key) {
            case " ": {
                ev.preventDefault();
                ev.stopPropagation();
                if (category) {
                    const checked = this.state.checked[category];
                    if (checked[id]) {
                        delete checked[id];
                    } else {
                        checked[id] = true;
                    }
                } else {
                    this.reload({ useTextFilter: true });
                }
                break;
            }
            case "Enter": {
                ev.preventDefault();
                ev.stopPropagation();
                if (category) {
                    const checked = this.state.checked[category];
                    if (checked[id]) {
                        delete checked[id];
                    } else {
                        checked[id] = true;
                    }
                }
                this.reload({ useTextFilter: !category });
                break;
            }
        }
    }

    reload({ useTextFilter } = {}) {
        if (useTextFilter) {
            setParams({
                filter: this.state.query,
                suite: null,
                tag: null,
                test: null,
            });
        } else {
            const { checked } = this.state;
            for (const category in checked) {
                for (const key in checked[category]) {
                    if (!checked[category][key]) {
                        delete checked[category][key];
                    }
                }
            }
            const { suites, tests, tags } = checked;
            setParams({
                filter: null,
                suite: Object.keys(suites),
                tag: Object.keys(tags),
                test: Object.keys(tests),
            });
        }
        refresh();
    }

    /**
     * @param {SearchCategory} category
     */
    uncheckCategory(category) {
        this.state.checked[category] = {};
    }
}
