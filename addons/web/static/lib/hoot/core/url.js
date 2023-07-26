/** @odoo-module **/

import { onWillRender, reactive, useState } from "@odoo/owl";
import { Error, Object, Set, URL, URLSearchParams, location } from "../globals";
import { isIterable, log } from "../utils";

/**
 * @typedef {keyof typeof URL_PARAMS} URLParam
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const BOOLEAN_REGEX = /^true|false$/i;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {{
 *  append?: Record<URLParam, any>;
 *  delete?: URLParam[]
 *  set?: Record<URLParam, any>;
 * }} params
 */
export function createURL(params) {
    const url = new URL(location.href);
    for (const key in params) {
        url.searchParams.delete(key);
        if (!(key in URL_PARAMS)) {
            throw new Error(`Unknown URL param key: "${key}"`);
        }
        for (const value of params[key] || []) {
            url.searchParams.append(key, value);
        }
    }
    return url;
}

/**
 * @param {{ history: History, location: Location }} params
 */
export function makeURLStore({ history, location }) {
    /**
     * @param {string | URL} url
     * @param {string | URL} url
     */
    function goto(url, silent = false) {
        url = url.toString();
        history.replaceState({ path: url }, "", url);
        if (!silent) {
            processURL();
        }
    }

    function processParams() {
        const url = createURL();
        url.search = "";
        for (const key in urlParams) {
            for (const value of urlParams[key]) {
                url.searchParams.append(key, value);
            }
        }
        return url;
    }

    /**
     * @param {string} value
     */
    function processParamValue(value) {
        if (BOOLEAN_REGEX.test(value)) {
            return value.toLowerCase() === "true";
        } else if (!isNaN(value)) {
            return Number(value);
        } else {
            return value;
        }
    }

    function processURL() {
        const searchParams = new URLSearchParams(location.search);
        const keys = new Set(searchParams.keys());
        for (const key in urlParams) {
            if (keys.has(key)) {
                keys.delete(key);
                urlParams[key] = searchParams.getAll(key).map(processParamValue);
            } else {
                delete urlParams[key];
            }
        }
        for (const key of keys) {
            urlParams[key] = searchParams.getAll(key).map(processParamValue);
        }
    }

    function refresh() {
        location.reload();
    }

    /**
     * @param {Record<URLParam, any>} values
     */
    function setParams(values) {
        for (const key in values) {
            if (!(key in URL_PARAMS)) {
                throw new Error(`Unknown URL param key: "${key}"`);
            }
            const value = values[key];
            if ([null, undefined].includes(value)) {
                delete urlParams[key];
            } else {
                urlParams[key] = isIterable(value) ? [...value] : [value];
            }
        }

        goto(processParams(), true);
    }

    /**
     * @param  {...string} keys
     */
    function subscribe(...keys) {
        const state = useState(urlParams);
        if (keys.length) {
            const all = keys.at(-1) === "*";
            onWillRender(() => {
                const observedKeys = all ? Object.keys(state) : keys;
                observedKeys.forEach((key) => state[key]);
            });
        }
        return state;
    }

    /**
     * @param {URLParam} type
     * @param {string} id
     */
    function withParams(type, id) {
        const append = (id, category) => {
            const items = urlParams[category];
            if (!items) {
                return [id];
            }
            const set = new Set(items);
            set.add(id);
            return set;
        };

        const remove = (id, category) => {
            const items = urlParams[category];
            if (!items) {
                return null;
            }
            const set = new Set(items);
            set.delete(id);
            return set;
        };

        const params = { ...FILTER_PARAMS };
        for (const key in params) {
            params[key] = null;
        }

        switch (type) {
            case "debugTest": {
                return createURL({ ...params, debugTest: [id] });
            }
            case "skip": {
                if (urlParams.skip?.includes(id)) {
                    return createURL({ skip: remove(id, "skip") });
                } else {
                    return createURL({
                        debugTest: remove(id, "debugTest"),
                        skip: append(id, "skip"),
                        suite: remove(id, "suite"),
                        test: remove(id, "test"),
                    });
                }
            }
            case "suite": {
                return createURL({ ...params, suite: [id], skip: remove(id, "skip") });
            }
            case "tag": {
                return createURL({ ...params, tag: [id] });
            }
            case "test": {
                return createURL({ ...params, test: [id], skip: remove(id, "skip") });
            }
            default: {
                return createURL(params);
            }
        }
    }

    /** @type {Record<URLParam, any[]>} */
    const urlParams = reactive({});

    processURL();

    return {
        get params() {
            return urlParams;
        },
        goto,
        refresh,
        setParams,
        subscribe,
        withParams,
    };
}

export const DEFAULT_CONFIG = {
    /**
     * Whether the test runner will start automatically on page load.
     * @type {boolean}
     * @default true
     */
    autostart: true,
    /**
     * If true, the test runner will stop after the first failed test (not the
     * first failed assertion - the current test will finish properly before stopping).
     * @type {boolean}
     * @default false
     */
    failfast: false,
    /**
     * Whether to render the test runner user interface.
     * Note: this cannot be changed on runtime: the UI will not be un-rendered or
     * rendered if this param changes.
     * @type {boolean}
     * @default false
     */
    headless: false,
    /**
     * Prevents adding tests outside of test suites.
     * @type {boolean}
     * @default false
     */
    nostandalone: false,
    /**
     * Removes the safety try .. catch statements around the tests' run functions
     * to let errors bubble to the browser.
     * @type {boolean}
     * @default false
     */
    notrycatch: false,
    /**
     * Shuffles the running order of tests and suites.
     * @type {boolean}
     * @default false
     */
    randomorder: false,
    /**
     * Determines how the failed tests must be unfolded in the UI:
     * - "first-fail": only the first failed test will be unfolded
     * - "failed": all failed tests will be unfolded
     * - false: all tests will remain folded
     * @type {"first-fail" | "failed" | false}
     * @default "first-fail"
     */
    showdetail: "first-fail",
    /**
     * Shows all completed tests, including those who passed.
     * @type {boolean}
     * @default false
     */
    showpassed: false,
    /**
     * Duration at the end of which a test will automatically fail.
     * @type {number}
     * @default 10_000
     */
    timeout: /* 1O seconds */ 10_000,
    /**
     * Other configuration parameters that will not appear in and cannot be affected
     * by the URL.
     */
    meta: {
        /**
         * Interval between reporting renders in milliseconds.
         * @type {number}
         * @default 100
         */
        renderInterval: 100,
    },
};

export const FILTER_PARAMS = {
    debugTest: "debugTest",
    filter: "filter",
    skip: "skip",
    suite: "suite",
    tag: "tag",
    test: "test",
};

export const URL_PARAMS = { ...DEFAULT_CONFIG, ...FILTER_PARAMS };
