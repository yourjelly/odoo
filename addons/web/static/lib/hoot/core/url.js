/** @odoo-module **/

import { onWillRender, reactive, useState } from "@odoo/owl";
import { Error, Object, Set, URL, URLSearchParams, history, location } from "../globals";
import { isIterable } from "../utils";

/**
 * @typedef {keyof typeof URL_PARAMS} URLParam
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

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

function processURL() {
    const searchParams = new URLSearchParams(location.search);
    const keys = new Set(searchParams.keys());
    for (const key in urlParams) {
        if (keys.has(key)) {
            keys.delete(key);
            urlParams[key] = searchParams.getAll(key);
        } else {
            delete urlParams[key];
        }
    }
    for (const key of keys) {
        urlParams[key] = searchParams.getAll(key);
    }
}

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
 * @param {string | URL} url
 * @param {string | URL} url
 */
export function goto(url, silent = false) {
    url = url.toString();
    history.replaceState({ path: url }, "", url);
    if (!silent) {
        processURL();
    }
}

export function refresh() {
    location.reload();
}

/**
 * @param {Record<URLParam, any>} values
 */
export function setParams(values) {
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
export function subscribeToURLParams(...keys) {
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
export function withParams(type, id) {
    const clearAll = () => Object.keys(nextParams).forEach((key) => nextParams[key].clear());

    const nextParams = Object.fromEntries(
        Object.keys(FILTER_PARAMS).map((k) => [k, new Set(urlParams[k] || [])])
    );

    let skip = false;
    if (type && type.startsWith("skip-")) {
        skip = true;
        type = type.slice("skip-".length);
    }

    switch (type) {
        case "debugTest": {
            nextParams.debugTest.add(id);
            nextParams.suite.clear();
            nextParams.tag.clear();
            nextParams.test.clear();
            break;
        }
        case "suite": {
            const skippedId = SKIP_PREFIX + id;
            if (skip) {
                if (nextParams.suite.has(skippedId)) {
                    nextParams.suite.delete(skippedId);
                } else {
                    nextParams.suite.add(skippedId);
                }
            } else {
                clearAll();
                nextParams.suite.add(id);
            }
            break;
        }
        case "tag": {
            const skippedId = SKIP_PREFIX + id;
            if (skip) {
                if (nextParams.tag.has(skippedId)) {
                    nextParams.tag.delete(skippedId);
                } else {
                    nextParams.tag.add(skippedId);
                }
            } else {
                clearAll();
                nextParams.tag.add(id);
            }
            break;
        }
        case "test": {
            const skippedId = SKIP_PREFIX + id;
            if (skip) {
                if (nextParams.test.has(skippedId)) {
                    nextParams.test.delete(skippedId);
                } else {
                    nextParams.test.add(skippedId);
                    nextParams.debugTest.delete(skippedId);
                }
            } else {
                clearAll();
                nextParams.test.add(id);
            }
            break;
        }
        default: {
            clearAll();
        }
    }

    for (const key in nextParams) {
        if (!nextParams[key].size) {
            nextParams[key] = null;
        }
    }

    return createURL(nextParams);
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
     * Hides all skipped tests.
     * @type {boolean}
     * @default false
     */
    hideskipped: false,
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
     * Shows all completed tests including those who passed.
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
};

export const FILTER_PARAMS = {
    debugTest: "debugTest",
    filter: "filter",
    suite: "suite",
    tag: "tag",
    test: "test",
};

export const SKIP_PREFIX = "-";

export const URL_PARAMS = { ...DEFAULT_CONFIG, ...FILTER_PARAMS };

/** @type {Record<URLParam, any[]>} */
export const urlParams = reactive({});

processURL();
