/** @odoo-module **/

import { onWillRender, reactive, useState } from "@odoo/owl";
import { Error, Object, Set, URL, URLSearchParams, history, location } from "../globals";
import { isIterable } from "../utils";
import { CONFIG_KEYS, CONFIG_SCHEMA, FILTER_KEYS, FILTER_SCHEMA } from "./config";

/**
 * @typedef {typeof import("./config").DEFAULT_CONFIG} DEFAULT_CONFIG
 *
 * @typedef {typeof import("./config").DEFAULT_FILTERS} DEFAULT_FILTERS
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

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
 * @param {Partial<DEFAULT_CONFIG & DEFAULT_FILTERS>} params
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
 * @param {Partial<DEFAULT_CONFIG & DEFAULT_FILTERS>} params
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
 * @param {...(keyof DEFAULT_CONFIG | keyof DEFAULT_FILTERS | "*")} keys
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
 * @param {keyof DEFAULT_FILTERS | `skip-${keyof DEFAULT_FILTERS}`} type
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

export const SKIP_PREFIX = "-";

/** @type {Partial<DEFAULT_CONFIG & DEFAULT_FILTERS>} */
export const urlParams = reactive({});

processURL();
