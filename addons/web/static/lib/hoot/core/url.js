/** @odoo-module **/

import { onWillRender, reactive, useState } from "@odoo/owl";
import { Error, Object, Set, URL, URLSearchParams, history, location } from "../globals";
import { isIterable } from "../utils";

/**
 * @template T
 * @typedef {{ [key in keyof T]: ReturnType<T[key]["parse"]> }} InferFromSchema
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @template T
 * @param {T} schema
 * @returns {{ [key in keyof T]: ReturnType<T[key]["parse"]> }}
 */
const getSchemaDefaults = (schema) =>
    Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, value.default]));

/**
 * @template T
 * @param {T} schema
 * @returns {(keyof T)[]}
 */
const getSchemaKeys = (schema) => Object.keys(schema);

/**
 * @template T
 * @param {(values: string[]) => T} parse
 * @returns {(valueIfEmpty: T) => (values: string[]) => T}
 */
const makeParser = (parse) => (valueIfEmpty) => (values) =>
    values.length ? parse(values) : valueIfEmpty;

const parseBoolean = makeParser(([value]) => value === "true");

const parseNumber = makeParser(([value]) => Number(value) || 0);

/** @type {ReturnType<typeof makeParser<"first-fail" | "failed" | false>>} */
const parseShowDetail = makeParser(([value]) => (value === "false" ? false : value));

const parseString = makeParser(([value]) => value);

const parseStringArray = makeParser((values) => values);

const processParams = () => {
    const url = createURL();
    url.search = "";
    for (const [key, value] of Object.entries(urlParams)) {
        if (isIterable(value)) {
            for (const value of urlParams[key]) {
                if (value) {
                    url.searchParams.append(key, value);
                }
            }
        } else if (value) {
            url.searchParams.set(key, value);
        }
    }
    return url;
};

const processURL = () => {
    const searchParams = new URLSearchParams(location.search);
    const keys = new Set(searchParams.keys());
    for (const [key, { parse }] of Object.entries({ ...CONFIG_SCHEMA, ...FILTER_SCHEMA })) {
        if (keys.has(key)) {
            urlParams[key] = parse(searchParams.getAll(key).filter(Boolean));
        } else {
            delete urlParams[key];
        }
    }
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {Partial<typeof DEFAULT_CONFIG | typeof DEFAULT_FILTERS>} params
 */
export function createURL(params) {
    const url = new URL(location.href);
    for (const key in params) {
        url.searchParams.delete(key);
        if (!CONFIG_KEYS.includes(key) && !FILTER_KEYS.includes(key)) {
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
 * @param {Partial<typeof DEFAULT_CONFIG | typeof DEFAULT_FILTERS>} params
 */
export function setParams(params) {
    for (const [key, value] in Object.entries(params)) {
        if (!CONFIG_KEYS.includes(key) && !FILTER_KEYS.includes(key)) {
            throw new Error(`Unknown URL param key: "${key}"`);
        }
        if (value) {
            urlParams[key] = isIterable(value) ? [...value] : value;
        } else {
            delete urlParams[key];
        }
    }

    goto(processParams(), true);
}

/**
 * @param {...(keyof typeof CONFIG_SCHEMA | keyof typeof FILTER_SCHEMA | "*")} keys
 */
export function subscribeToURLParams(...keys) {
    const state = useState(urlParams);
    if (keys.length) {
        const observedKeys = keys.includes("*") ? [...CONFIG_KEYS, ...FILTER_KEYS] : keys;
        onWillRender(() => observedKeys.forEach((key) => state[key]));
    }
    return state;
}

/**
 * @param {keyof typeof FILTER_SCHEMA | `skip-${keyof typeof FILTER_SCHEMA}`} type
 * @param {string} id
 */
export function withParams(type, id) {
    const clearAll = () => Object.keys(nextParams).forEach((key) => nextParams[key].clear());

    const nextParams = Object.fromEntries(FILTER_KEYS.map((k) => [k, new Set(urlParams[k] || [])]));
    delete nextParams.filter;

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

export const CONFIG_SCHEMA = {
    /**
     * Amount of failed tests after which the test runner will be aborted.
     * A falsy value (including 0) means that the runner should not be aborted.
     */
    bail: {
        default: 0,
        parse: parseNumber(1),
    },
    /**
     * Whether to render the test runner user interface.
     * Note: this cannot be changed on runtime: the UI will not be un-rendered or
     * rendered if this param changes.
     */
    headless: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Hides all skipped tests.
     */
    hideskipped: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Whether the test runner must be manually started after page load (defaults
     * to starting automatically).
     */
    manual: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Removes the safety try .. catch statements around the tests' run functions
     * to let errors bubble to the browser.
     */
    notrycatch: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Shuffles the running order of tests and suites.
     */
    randomorder: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Determines how the failed tests must be unfolded in the UI:
     * - "first-fail": only the first failed test will be unfolded
     * - "failed": all failed tests will be unfolded
     * - false: all tests will remain folded
     */
    showdetail: {
        default: "first-fail",
        parse: parseShowDetail("failed"),
    },
    /**
     * Shows all completed tests including those who passed.
     */
    showpassed: {
        default: false,
        parse: parseBoolean(true),
    },
    /**
     * Duration (in seconds) at the end of which a test will automatically fail.
     */
    timeout: {
        default: 10,
        parse: parseNumber(10),
    },
};

export const FILTER_SCHEMA = {
    debugTest: {
        default: [],
        parse: parseStringArray([]),
    },
    filter: {
        default: "",
        parse: parseString(""),
    },
    suite: {
        default: [],
        parse: parseStringArray([]),
    },
    tag: {
        default: [],
        parse: parseStringArray([]),
    },
    test: {
        default: [],
        parse: parseStringArray([]),
    },
};

/** @see {CONFIG_SCHEMA} */
export const DEFAULT_CONFIG = getSchemaDefaults(CONFIG_SCHEMA);
export const CONFIG_KEYS = getSchemaKeys(CONFIG_SCHEMA);

/** @see {FILTER_SCHEMA} */
export const DEFAULT_FILTERS = getSchemaDefaults(FILTER_SCHEMA);
export const FILTER_KEYS = getSchemaKeys(FILTER_SCHEMA);

export const SKIP_PREFIX = "-";

/** @type {Partial<typeof DEFAULT_CONFIG & typeof DEFAULT_FILTERS>} */
export const urlParams = reactive({});

processURL();
