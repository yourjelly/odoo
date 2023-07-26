/** @odoo-module **/

import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { Tag } from "../core/tag";
import { Object } from "../globals";
import { compactXML, debounce, isRegExpFilter, lookup, title } from "../utils";
import { ICONS } from "./icons";
import { TagButton } from "./tag_button";

/**
 * @typedef {"suites" | "tags" | "tests"} SearchCategory
 */

/**
 * @param {string[]} values
 */
const toObject = (values) => values.reduce((obj, value) => ({ ...obj, [value]: true }), {});

/** @extends Component<{}, import("../setup").Environment> */
export class Search extends Component {
    static components = { TagButton };

    static template = compactXML/* xml */ `
        <div class="hoot-search hoot-relative" t-ref="root" t-on-keydown="onKeyDown">
            <form class="hoot-row hoot-gap-1" t-on-submit.prevent="onSubmit">
                <div class="hoot-search-bar hoot-row hoot-gap-1">
                    <t t-foreach="getCategoryCounts()" t-as="count" t-key="count.id">
                        <button
                            type="submit"
                            class="hoot-btn hoot-row hoot-gap-1 hoot-px-1 hoot-py-0.5"
                            title="Remove all"
                            t-on-click="() => this.uncheckCategory(count.id)"
                        >
                            <t t-out="count.icon" />
                            <t t-esc="count.value" />
                        </button>
                    </t>
                    <input
                        type="text"
                        class="hoot-px-1"
                        autofocus="autofocus"
                        placeholder="Filter suites, tests or tags"
                        t-ref="search-input"
                        t-model.trim="state.query"
                        t-on-input="onInput"
                    />
                </div>
                <button
                    type="submit"
                    class="hoot-btn hoot-py-1 hoot-px-2"
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
                            <li tabindex="0" t-on-keydown="onLineKeyDown">
                                <button
                                    class="hoot-dropdown-line"
                                    title="Run this filter"
                                    t-on-click="() => this.reload({ withFilter: true })"
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
                                                    <TagButton tag="item" disabled="true" />
                                                </t>
                                                <t t-else="">
                                                    <span t-esc="item.fullName or item.name" />
                                                </t>
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
            icon: ICONS.chain,
        },
        {
            id: "tests",
            singular: "test",
            plural: "tests",
            icon: ICONS.test,
        },
        {
            id: "tags",
            singular: "tag",
            plural: "tags",
            icon: ICONS.label,
        },
    ];
    title = title;

    get urlFilter() {
        return (this.urlParams.filter || []).join(" ");
    }

    setup() {
        this.rootRef = useRef("root");
        this.searchInputRef = useRef("search-input");
        this.urlParams = this.env.url.subscribe();
        this.state = useState({
            query: this.urlFilter,
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
            this.state.showDropdown = this.rootRef.el.contains(ev.target);
        });
    }

    findSuggestions() {
        const { runner } = this.env;
        const { query } = this.state;
        return {
            suites: lookup(query, runner.suites, (suite) => suite.fullName),
            tests: lookup(query, runner.tests, (test) => test.fullName),
            tags: lookup(query, runner.tags, (tag) => tag.name),
        };
    }

    getCategoryCounts() {
        const { checked } = this.state;
        const counts = [];
        for (const { id, icon } of this.categories) {
            const count = Object.values(checked[id]).filter(Boolean).length;
            if (count) {
                counts.push({ id, icon, value: count });
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
        this.reload();
    }

    onInput() {
        this.state.buttonDisabled = !this.state.query || this.state.query === this.urlFilter;
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
            case "Enter": {
                ev.preventDefault();
                return this.reload();
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
                    this.reload({ withFilter: true });
                }
                break;
            }
            case "Enter": {
                ev.preventDefault();
                ev.stopPropagation();
                this.reload({ withFilter: !category });
                break;
            }
        }
    }

    reload({ withFilter } = {}) {
        if (withFilter) {
            this.env.url.setParams({
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
            this.env.url.setParams({
                filter: null,
                suite: Object.keys(suites),
                tag: Object.keys(tags),
                test: Object.keys(tests),
            });
        }
        console.log({ withFilter });
        this.env.url.refresh();
    }

    /**
     * @param {SearchCategory} category
     */
    uncheckCategory(category) {
        this.state.checked[category] = {};
    }
}
