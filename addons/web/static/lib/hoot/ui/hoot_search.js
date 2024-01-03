/** @odoo-module */

import { Component, useExternalListener, useRef, useState, xml } from "@odoo/owl";
import { isRegExpFilter, parseRegExp } from "@web/../lib/hoot-dom/hoot_dom_utils";
import { Suite } from "../core/suite";
import { Tag } from "../core/tag";
import { EXCLUDE_PREFIX, refresh, setParams, subscribeToURLParams } from "../core/url";
import { debounce, lookup, normalize, title } from "../hoot_utils";
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

/**
 * @param {string} query
 */
const getPattern = (query) => {
    query = query.match(R_QUERY_CONTENT)[1];
    return parseRegExp(normalize(query));
};

const EMPTY_SUITE = new Suite(null, "...", []);
const R_QUERY_CONTENT = new RegExp(`^\\s*${EXCLUDE_PREFIX}?\\s*(.*)\\s*$`);

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/** @extends {Component<HootSearchProps, import("../hoot").Environment>} */
export class HootSearch extends Component {
    static components = { HootTagButton };

    static props = {};

    static template = xml`
        <t t-set="hasIncludeValue" t-value="getHasIncludeValue()" />
        <t t-set="isRunning" t-value="runnerState.status === 'running'" />
        <search class="hoot-search" t-ref="root" t-on-keydown="onKeyDown">
            <form class="dropdown" t-on-submit.prevent="refresh">
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
                        t-on-keydown="onSearchInputKeyDown"
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
                            t-on-change="toggleRegExp"
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
                            t-on-change="toggleDebug"
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
                                    type="submit"
                                    title="Run this filter"
                                    t-on-pointerdown="() => this.updateParams(true)"
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
                                            <t t-set="checked" t-value="runnerState.includeMap[category]" />
                                            <li
                                                class="d-flex align-items-center gap-1 cursor-pointer user-select-none"
                                                t-on-click="() => this.toggleInclude(category, job.id)"
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
            </form>
        </search>
    `;

    categories = ["suites", "tests", "tags"];
    useTextFilter = false;
    refresh = refresh;
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
        const checked = this.runnerState.includeMap[category];

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
        const pattern = getPattern(this.state.query);
        return {
            suites: this.filterItems(pattern, suites, "suites"),
            tags: this.filterItems(pattern, tags, "tags"),
            tests: this.filterItems(pattern, tests, "tests"),
        };
    }

    getCategoryCounts() {
        const checked = this.runnerState.includeMap;
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
        return Object.values(this.runnerState.includeMap).some((values) =>
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
     * @param {KeyboardEvent} ev
     */
    onDebugKeyDown(ev) {
        switch (ev.key) {
            case "Enter":
            case " ": {
                ev.preventDefault();
                this.toggleDebug();
                break;
            }
        }
    }

    /**
     * @param {SearchCategory} categoryId
     * @param {string} id
     * @param {"exclude" | "include"} value
     */
    onIncludeChange(categoryId, id, value) {
        if (value === "include" || value === "exclude") {
            this.setInclude(categoryId, id, value === "include");
        } else {
            this.setInclude(categoryId, id, null);
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
     * @param {KeyboardEvent} ev
     */
    onRegExpKeyDown(ev) {
        switch (ev.key) {
            case "Enter":
            case " ": {
                ev.preventDefault();
                this.toggleRegExp();
                break;
            }
        }
    }

    onSearchInputInput() {
        this.updateParams(true);
        this.updateSuggestions();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onSearchInputKeyDown(ev) {
        switch (ev.key) {
            case "Backspace": {
                if (ev.target.selectionStart === 0 && ev.target.selectionEnd === 0) {
                    this.uncheckLastCategory();
                }
                break;
            }
            case "r": {
                if (ev.altKey) {
                    this.toggleRegExp();
                }
                break;
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
     * @param {SearchCategory} categoryId
     * @param {string} id
     * @param {boolean | null} [value]
     */
    setInclude(categoryId, id, value) {
        if (typeof value === "boolean") {
            this.runnerState.includeMap[categoryId][id] = value;
        } else {
            delete this.runnerState.includeMap[categoryId][id];
        }

        this.updateParams(false);
    }

    toggleDebug() {
        setParams({ debugTest: !this.urlParams.debugTest });
    }

    toggleRegExp() {
        if (this.useRegExp) {
            this.state.query = this.state.query.slice(1, -1);
        } else {
            this.state.query = `/${this.state.query}/`;
        }
        this.updateParams(true);
        this.updateSuggestions();
    }

    uncheckLastCategory() {
        const checked = this.runnerState.includeMap;
        for (const category of [...this.categories].reverse()) {
            if (Object.keys(checked[category]).length) {
                checked[category] = {};
                this.updateParams();
                return true;
            }
        }
        return false;
    }

    /**
     * @param {boolean} [setUseTextFilter]
     */
    updateParams(setUseTextFilter) {
        if (typeof setUseTextFilter === "boolean") {
            this.useTextFilter = setUseTextFilter;
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
                suite: formatIncludes(this.runnerState.includeMap.suites),
                tag: formatIncludes(this.runnerState.includeMap.tags),
                test: formatIncludes(this.runnerState.includeMap.tests),
            });
        }
    }

    /**
     * @param {SearchCategory} categoryId
     * @param {string} id
     */
    toggleInclude(categoryId, id) {
        const currentValue = this.runnerState.includeMap[categoryId][id];
        if (currentValue === true) {
            this.setInclude(categoryId, id, false);
        } else if (currentValue === false) {
            this.setInclude(categoryId, id, null);
        } else {
            this.setInclude(categoryId, id, true);
        }
    }
}
