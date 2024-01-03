/** @odoo-module */

import { Component, useExternalListener, useRef, useState, xml } from "@odoo/owl";
import { isRegExpFilter } from "@web/../lib/hoot-dom/hoot_dom_utils";
import { Suite } from "../core/suite";
import { Tag } from "../core/tag";
import { EXCLUDE_PREFIX, refresh, setParams, subscribeToURLParams } from "../core/url";
import { debounce, isNil, lookup, title } from "../hoot_utils";
import { HootTagButton } from "./hoot_tag_button";

/**
 * @typedef {{}} HootSearchProps
 *
 * @typedef {"suites" | "tags" | "tests"} SearchCategory
 *
 * @typedef {import("../core/tag").Tag} Tag
 *
 * @typedef {import("../core/test").Test} Test
 */

//-----------------------------------------------------------------------------
// Global
//-----------------------------------------------------------------------------

const { document, Object, window } = globalThis;

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 *
 * @param {Record<string, boolean>} values
 */
const formatIncludes = (values) =>
    Object.entries(values).map(([id, value]) => (value ? id : `${EXCLUDE_PREFIX}${id}`));

const EMPTY_SUITE = new Suite(null, "...", []);

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/** @extends Component<HootSearchProps, import("../hoot").Environment> */
export class HootSearch extends Component {
    static components = { HootTagButton };

    static props = {};

    static template = xml`
        <t t-set="hasIncludeValue" t-value="getHasIncludeValue()" />
        <t t-set="isRunning" t-value="runnerState.status === 'running'" />
        <div class="hoot-search dropdown" t-ref="root" t-on-keydown="onKeyDown">
            <div class="hoot-search-bar d-flex align-items-center px-1 gap-1">
                <t t-foreach="getCategoryCounts()" t-as="count" t-key="count.category">
                    <button
                        type="button"
                        class="hoot-btn hoot-border-primary rounded"
                        t-att-title="count.tip"
                    >
                        <span class="hoot-bg-primary px-1" t-esc="count.category" />
                        <span class="mx-1 d-flex gap-1">
                            <t t-if="count.include">
                                <span class="hoot-text-pass" t-esc="count.include" />
                            </t>
                            <t t-if="count.exclude">
                                <span class="hoot-text-fail" t-esc="count.exclude" />
                            </t>
                        </span>
                    </button>
                </t>
                <input
                    type="text"
                    class="w-100 rounded p-1"
                    autofocus="autofocus"
                    placeholder="Filter suites, tests or tags"
                    t-ref="search-input"
                    t-att-disabled="isRunning"
                    t-model.trim="state.query"
                    t-on-input="onSearchInputInput"
                    t-on-keydown="onSearchInputKeydown"
                />
                <label
                    class="hoot-search-icon cursor-pointer p-1"
                    title="Toggle between text and regular expression"
                    tabindex="0"
                    t-on-keydown="onRegExpKeyDown"
                >
                    <input
                        type="checkbox"
                        class="d-none"
                        t-att-checked="useRegExp"
                        t-att-disabled="isRunning"
                        t-on-change="onRegExpChange"
                    />
                    <i class="fa fa-asterisk" />
                </label>
                <label
                    class="hoot-search-icon cursor-pointer p-1"
                    title="Toggle debug mode"
                    tabindex="0"
                    t-on-keydown="onDebugKeyDown"
                >
                    <input
                        type="checkbox"
                        class="d-none"
                        t-att-checked="urlParams.debugTest"
                        t-att-disabled="isRunning"
                        t-on-change="onDebugChange"
                    />
                    <i class="fa fa-bug" />
                </label>
            </div>
            <t t-if="state.showDropdown">
                <div class="hoot-dropdown position-absolute px-2 py-3 shadow rounded">
                    <div class="hoot-dropdown-category d-flex mb-2">
                        <t t-if="state.query">
                            <button
                                class="d-flex align-items-center gap-1"
                                t-on-click="() => this.reload({ useTextFilter: true })"
                                title="Run this filter"
                            >
                                <h6 class="hoot-text-primary m-0">
                                    Filter using
                                    <t t-if="useRegExp">
                                        regular expression
                                    </t>
                                    <t t-else="">
                                        text
                                    </t>
                                </h6>
                                <t t-esc="wrappedQuery" />
                            </button>
                        </t>
                        <t t-else="">
                            <em class="hoot-text-muted ms-1">
                                Start typing to show filters...
                            </em>
                        </t>
                    </div>
                    <t t-foreach="categories" t-as="category" t-key="category">
                        <t t-if="state.categories[category].length">
                            <div class="hoot-dropdown-category d-flex flex-column mb-2">
                                <h6 class="hoot-text-primary fw-bold d-flex align-items-center mb-2">
                                    <span class="w-100">
                                        <t t-esc="title(category)" />
                                        (<t t-esc="state.categories[category].length" />)
                                    </span>
                                </h6>
                                <ul class="hoot-dropdown-lines d-flex flex-column m-0 list-unstyled gap-1">
                                    <t t-foreach="state.categories[category]" t-as="job" t-key="job.id">
                                        <t t-set="checked" t-value="state.checked[category]" />
                                        <li
                                            class="d-flex align-items-center gap-1 cursor-pointer user-select-none"
                                            t-on-click="() => this.toggleInclude(category, job.id)"
                                            t-on-keydown="(ev) => this.onLineKeyDown(ev, { useTextFilter: false })"
                                        >
                                            <div
                                                class="hoot-include-widget"
                                                t-on-click.stop=""
                                                t-on-change="(ev) => this.onIncludeChange(category, job.id, ev.target.value)"
                                            >
                                                <input
                                                    type="radio"
                                                    title="Exclude"
                                                    t-att-name="job.id" value="exclude"
                                                    t-att-checked="checked[job.id] === false"
                                                />
                                                <input
                                                    type="radio"
                                                    t-att-name="job.id" value="null"
                                                    t-att-checked="![true, false].includes(checked[job.id])"
                                                />
                                                <input
                                                    type="radio"
                                                    title="Include"
                                                    t-att-name="job.id" value="include"
                                                    t-att-checked="checked[job.id] === true"
                                                />
                                            </div>
                                            <t t-if="isTag(job)">
                                                <HootTagButton tag="job" disabled="true" />
                                            </t>
                                            <t t-else="">
                                                <span class="hoot-path d-flex align-items-center fw-bold text-nowrap overflow-hidden" t-att-title="job.fullName">
                                                    <t t-foreach="getShortPath(job.path)" t-as="suite" t-key="suite.id">
                                                        <span class="hoot-text-muted px-1" t-esc="suite.name" />
                                                        <span class="fw-normal">/</span>
                                                    </t>
                                                    <t t-set="isSet" t-value="job.id in checked" />
                                                    <span
                                                        class="text-truncate px-1"
                                                        t-att-class="{
                                                            'fw-bolder': isSet,
                                                            'hoot-text-pass': checked[job.id] === true,
                                                            'hoot-text-fail': checked[job.id] === false,
                                                            'hoot-text-muted': !isSet and hasIncludeValue,
                                                            'hoot-text-primary': !isSet and !hasIncludeValue,
                                                            'fst-italic': hasIncludeValue ? !checked[job.id] : checked[job.id] === false,
                                                        }"
                                                        t-esc="job.name"
                                                    />
                                                </span>
                                            </t>
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

    categories = ["suites", "tests", "tags"];
    useTextFilter = false;
    title = title;

    get useRegExp() {
        return isRegExpFilter(this.state.query);
    }

    get wrappedQuery() {
        return this.useRegExp ? this.state.query : `"${this.state.query}"`;
    }

    updateSuggestions = debounce(() => {
        this.state.categories = this.findSuggestions();
        this.state.showDropdown = true;
    }, 16);

    setup() {
        const { runner } = this.env;

        runner.beforeAll(() => {
            this.state.categories = this.findSuggestions();
        });
        runner.afterAll(() => {
            this.searchInputRef.el?.focus();
        });

        this.rootRef = useRef("root");
        this.searchInputRef = useRef("search-input");
        this.urlParams = subscribeToURLParams("debugTest");
        this.state = useState({
            query: this.urlParams.filter || "",
            disabled: false,
            showDropdown: false,
            categories: {
                /** @type {Suite[]} */
                suites: [],
                /** @type {Tag[]} */
                tags: [],
                /** @type {Test[]} */
                tests: [],
            },
            checked: {
                /** @type {Record<string, boolean>} */
                suites: JSON.parse(JSON.stringify(runner.includeMap.suites)),
                /** @type {Record<string, boolean>} */
                tags: JSON.parse(JSON.stringify(runner.includeMap.tags)),
                /** @type {Record<string, boolean>} */
                tests: JSON.parse(JSON.stringify(runner.includeMap.tests)),
            },
        });
        this.runnerState = useState(runner.state);

        useExternalListener(window, "click", this.onWindowClick);
    }

    /**
     * @param {string} query
     * @param {Iterable<Suite | Tag | Test>} items
     * @param {SearchCategory} category
     */
    filterItems(query, items, category) {
        const checked = this.state.checked[category];

        const result = [];
        const remaining = [];
        for (const item of items) {
            if (item.id in checked) {
                result.push(item);
            } else {
                remaining.push(item);
            }
        }

        const matching = lookup(query, remaining, (item) => item.key);
        result.push(...matching.slice(0, 5));

        return result;
    }

    findSuggestions() {
        const { suites, tags, tests } = this.env.runner;
        let query = this.state.query;
        if (query.startsWith(EXCLUDE_PREFIX)) {
            query = query.slice(EXCLUDE_PREFIX.length);
        }
        return {
            suites: this.filterItems(query, suites, "suites"),
            tags: this.filterItems(query, tags, "tags"),
            tests: this.filterItems(query, tests, "tests"),
        };
    }

    getCategoryCounts() {
        const { checked } = this.state;
        const counts = [];
        for (const category of this.categories) {
            let include = 0;
            let exclude = 0;
            for (const value of Object.values(checked[category])) {
                if (value === true) {
                    include++;
                } else if (value === false) {
                    exclude++;
                }
            }
            if (include + exclude) {
                counts.push({ category, tip: `Remove all ${category}`, include, exclude });
            }
        }
        return counts;
    }

    getHasIncludeValue() {
        return Object.values(this.state.checked).some((values) =>
            Object.values(values).includes(true)
        );
    }

    /**
     *
     * @param {(Suite | Test)[]} path
     */
    getShortPath(path) {
        if (path.length <= 3) {
            return path.slice(0, -1);
        } else {
            return [path.at(0), EMPTY_SUITE, path.at(-2)];
        }
    }

    /**
     * @param {unknown} item
     */
    isTag(item) {
        return item instanceof Tag;
    }

    /**
     * @param {Event} ev
     */
    onDebugChange(ev) {
        setParams({ debugTest: ev.target.checked });
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onDebugKeyDown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            ev.target.click();
        }
    }

    /**
     * @param {SearchCategory} categoryId
     * @param {string} id
     * @param {"exclude" | "include"} value
     */
    onIncludeChange(categoryId, id, value) {
        this.useTextFilter = false;
        if (value === "include" || value === "exclude") {
            this.state.checked[categoryId][id] = value === "include";
        } else {
            delete this.state.checked[categoryId][id];
        }
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
                ...this.rootRef.el.querySelectorAll("input[type=radio]:checked"),
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
                if (this.state.showDropdown) {
                    ev.preventDefault();
                    this.state.showDropdown = false;
                }
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

    /**
     *
     * @param {KeyboardEvent} ev
     * @param {{ useTextFilter: boolean }} params
     */
    onLineKeyDown(ev, params) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            ev.stopPropagation();
            this.reload(params);
        }
    }

    onRegExpChange() {
        this.useTextFilter = true;
        if (this.useRegExp) {
            this.state.query = this.state.query.slice(1, -1);
        } else {
            this.state.query = `/${this.state.query}/`;
        }
        this.updateSuggestions();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onRegExpKeyDown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            ev.target.click();
        }
    }

    onSearchInputInput() {
        this.useTextFilter = true;
        this.updateSuggestions();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onSearchInputKeydown(ev) {
        switch (ev.key) {
            case "Backspace": {
                if (ev.target.selectionEnd > 0) {
                    this.useTextFilter = true;
                }
                break;
            }
            case "Enter": {
                ev.preventDefault();
                return this.reload();
            }
        }
    }

    /**
     * @param {PointerEvent} ev
     */
    onWindowClick(ev) {
        if (this.runnerState.status !== "running") {
            this.state.showDropdown = this.rootRef.el?.contains(ev.target);
        }
    }

    /**
     * @param {{ useTextFilter?: boolean }} params
     */
    reload({ useTextFilter } = {}) {
        if (!isNil(useTextFilter)) {
            this.useTextFilter = useTextFilter;
        }
        if (this.useTextFilter) {
            setParams({
                filter: this.state.query,
                suite: null,
                tag: null,
                test: null,
            });
        } else {
            setParams({
                filter: null,
                suite: formatIncludes(this.state.checked.suites),
                tag: formatIncludes(this.state.checked.tags),
                test: formatIncludes(this.state.checked.tests),
            });
        }
        refresh();
    }
    /**
     * @param {SearchCategory} categoryId
     * @param {string} id
     */
    toggleInclude(categoryId, id) {
        this.useTextFilter = false;
        const currentValue = this.state.checked[categoryId][id];
        if (currentValue === true) {
            this.state.checked[categoryId][id] = false;
        } else if (currentValue === false) {
            delete this.state.checked[categoryId][id];
        } else {
            this.state.checked[categoryId][id] = true;
        }
    }
}
