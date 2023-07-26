/** @odoo-module **/

import { xml } from "@odoo/owl";
import {
    Boolean,
    clearTimeout,
    console,
    JSON,
    localStorage,
    Object,
    Proxy,
    sessionStorage,
    setTimeout,
    String,
} from "./globals";

/**
 * @typedef {string | RegExp | { new(): any }} Matcher
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * This private function computes a score that represent the fact that the
 * string contains the pattern, or not
 *
 * - If the score is 0, the string does not contain the letters of the pattern in
 *   the correct order.
 * - if the score is > 0, it actually contains the letters.
 *
 * Better matches will get a higher score: consecutive letters are better,
 * and a match closer to the beginning of the string is also scored higher.
 *
 * @param {string} pattern
 * @param {string} str
 */
function getFuzzyScore(pattern, str) {
    let totalScore = 0;
    let currentScore = 0;
    let len = str.length;
    let patternIndex = 0;

    pattern = pattern.toLowerCase();
    str = str.toLowerCase();

    for (let i = 0; i < len; i++) {
        if (str[i] === pattern[patternIndex]) {
            patternIndex++;
            currentScore += 100 + currentScore - i / 200;
        } else {
            currentScore = 0;
        }
        totalScore = totalScore + currentScore;
    }

    return patternIndex === pattern.length ? totalScore : 0;
}

const REGEX_PATTERN = /^\/(.*)\/([gim]+)?$/;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param  {...string} args
 */
export function compactXML(...args) {
    const template = String.raw(...args);
    return xml`${template.trim().replace(/>[\s\n]+</gm, "><")}`;
}

/**
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} delay
 * @returns {T}
 */
export function debounce(fn, delay) {
    let timeout;
    const name = `${fn.name} (debounced)`;
    return {
        [name](...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(args), delay);
        },
    }[name];
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {Set<unknown>} [cache=new Set()]
 * @returns {boolean}
 */
export function deepEqual(a, b, cache = new Set()) {
    if (a === b) {
        return true;
    }
    if (cache.has(a)) {
        return true;
    }
    const aType = typeof a;
    if (aType !== typeof b || !a || !b) {
        return false;
    }
    if (aType === "object") {
        cache.add(a);
        const aEntries = Object.entries(a);
        if (aEntries.length !== Object.keys(b).length) {
            return false;
        }
        return aEntries.every(([key, value]) => deepEqual(value, b[key], cache));
    }
    return false;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatHumanReadable(value) {
    if (typeof value === "string") {
        if (value.length > 255) {
            value = value.slice(0, 255) + "...";
        }
        return `"${value}"`;
    } else if (typeof value === "number") {
        return value << 0 === value ? String(value) : value.toFixed(3);
    } else if (typeof value === "function") {
        const name = value.name || "anonymous";
        const prefix = /^[A-Z][a-z]/.test(name) ? `class ${name}` : `Function ${name}()`;
        return `${prefix} { ... }`;
    } else if (value && typeof value === "object") {
        if (value instanceof RegExp) {
            return value.toString();
        } else if (value instanceof Date) {
            return value.toISOString();
        } else if (isElement(value)) {
            return `<${value.tagName.toLowerCase()} />`;
        } else if (isIterable(value)) {
            return `${value.constructor.name} [...]`;
        } else {
            return `${value.constructor.name} { ... }`;
        }
    }
    return String(value);
}

/**
 * @param {unknown} value
 * @param {Set<unknown>} [cache=new Set()]
 * @param {number} [depth=0]
 * @returns {string}
 */
export function formatTechnical(
    value,
    { cache = new Set(), depth = 0, isObjectValue = false } = {}
) {
    const baseIndent = isObjectValue ? "" : " ".repeat(depth * 2);
    if (typeof value === "string") {
        return `${baseIndent}"${value}"`;
    } else if (typeof value === "number") {
        return `${baseIndent}${value << 0 === value ? String(value) : value.toFixed(3)}`;
    } else if (typeof value === "function") {
        const name = value.name || "anonymous";
        const prefix = /^[A-Z][a-z]/.test(name) ? `class ${name}` : `Function ${name}()`;
        return `${baseIndent}${prefix} { ... }`;
    } else if (value && typeof value === "object") {
        if (cache.has(value)) {
            return `${baseIndent}${Array.isArray(value) ? "[...]" : "{ ... }"}`;
        } else {
            cache.add(value);
            const startIndent = " ".repeat((depth + 1) * 2);
            const endIndent = " ".repeat(depth * 2);
            if (value instanceof RegExp) {
                return `${baseIndent}${value.toString()}`;
            } else if (value instanceof Date) {
                return `${baseIndent}${value.toISOString()}`;
            } else if (isElement(value)) {
                return `<${toSelector(value)} />`;
            } else if (isIterable(value)) {
                const proto =
                    value.constructor.name === "Array" ? "" : `${value.constructor.name} `;
                return `${baseIndent}${proto}[\n${[...value].map(
                    (val) =>
                        `${startIndent}${formatTechnical(val, {
                            cache,
                            depth: depth + 1,
                            isObjectValue: true,
                        })},\n`
                )}${endIndent}]`;
            } else {
                const proto =
                    value.constructor.name === "Object" ? "" : `${value.constructor.name} `;
                return `${baseIndent}${proto}{\n${Object.entries(value).map(
                    ([k, v]) =>
                        `${startIndent}${k}: ${formatTechnical(v, {
                            cache,
                            depth: depth + 1,
                            isObjectValue: true,
                        })},\n`
                )}${endIndent}}`;
            }
        }
    }
    return `${baseIndent}${String(value)}`;
}

/**
 * Based on Java's String.hashCode, a simple but not
 * rigorously collision resistant hashing function
 *
 * @param {...string} strings
 */
export function generateHash(...strings) {
    const str = strings.join("\x1C");

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    // Convert the possibly negative integer hash code into an 8 character hex
    // string, which isn't strictly necessary but increases user understanding
    // that the id is a SHA-like hash
    return (hash + 2 ** 32).toString(16).slice(-8);
}

/**
 * @template T
 * @param {Iterable<T>} iter
 * @param {keyof T} [property]
 */
export function groupBy(iter, property) {
    /** @type {Record<string | number, T[]>} */
    const groups = {};
    for (const element of iter) {
        const group = element[property];
        if (!(group in groups)) {
            groups[group] = [];
        }
        groups[group].push(element);
    }
    return groups;
}

/**
 * @param {unknown} value
 */
export function isIterable(value) {
    return Boolean(value && typeof value === "object" && value[Symbol.iterator]);
}

export function isElement(value) {
    return value && typeof value === "object" && value.nodeType === 1;
}

/**
 * @param {string} filter
 */
export function isRegExpFilter(filter) {
    return REGEX_PATTERN.test(filter);
}

/** @type {Console["log"] & Console} */
export const log = makeTaggable(function log(...args) {
    const [firstTag] = args.pop();
    const logFn = firstTag in console ? console[firstTag] : console.log;
    const prefix = `%c[HOOT]%c`;
    const styles = [`color:#ff0080`, `color:inherit`];
    let firstArg = args.shift() ?? "";
    if (typeof firstArg === "string") {
        args.unshift(`${prefix} ${firstArg}`, ...styles);
    } else {
        args.unshift(prefix, ...styles, firstArg);
    }
    return logFn(...args);
});

/**
 * Return a list of things that matches a pattern, ordered by their 'score' (
 * higher score first). An higher score means that the match is better. For
 * example, consecutive letters are considered a better match.
 *
 * @template T
 * @param {string} pattern
 * @param {T[]} items
 * @param {(item: T) => string} mapFn
 * @returns {T[]}
 */
export function lookup(pattern, items, mapFn = (x) => x) {
    const regexParams = pattern.match(REGEX_PATTERN);
    if (regexParams) {
        // Regex lookup
        let regex;
        try {
            regex = new RegExp(regexParams[1], regexParams[2]);
        } catch (err) {
            if (err instanceof SyntaxError) {
                return [];
            } else {
                throw err;
            }
        }
        return items.filter((item) => regex.test(mapFn(item)));
    } else {
        // Fuzzy lookup
        const results = [];
        for (const item of items) {
            const score = getFuzzyScore(pattern, mapFn(item));
            if (score > 0) {
                results.push([score, item]);
            }
        }
        // we want better matches first
        return results.sort((a, b) => b[0] - a[0]).map((r) => r[1]);
    }
}

export function makeCallbacks() {
    function add(type, callbackOrCallbacks) {
        if (!callbackRegistry[type]) {
            callbackRegistry[type] = new Set();
        }
        if (callbackOrCallbacks && callbackOrCallbacks._getCallbacks) {
            for (const callback of callbackOrCallbacks._getCallbacks(type)) {
                callbackRegistry[type].add(callback);
            }
        } else {
            callbackRegistry[type].add(callbackOrCallbacks);
        }
    }

    /**
     * @param {string} type
     * @param {...any} args
     */
    async function call(type, ...args) {
        if (!callbackRegistry[type]) {
            return;
        }
        const fns = [...callbackRegistry[type]];
        await Promise.all(fns.map((fn) => Promise.resolve(fn(...args)).catch(console.error)));
    }

    function remove(type, ...callbackOrCallbacks) {
        if (!callbackRegistry[type]) {
            return;
        }
        if (callbackOrCallbacks && callbackOrCallbacks._getCallbacks) {
            for (const callback of callbackOrCallbacks._getCallbacks(type)) {
                callbackRegistry[type].delete(callback);
            }
        } else {
            callbackRegistry[type].delete(callbackOrCallbacks);
        }
    }

    /** @type {Record<string, ((...args: any[]) => Promise<void>)[]>} */
    const callbackRegistry = {};

    return { add, call, remove, _getCallbacks: (type) => callbackRegistry[type] || [] };
}

/**
 * @template {(...args: any) => any} T
 * @param {T} fn
 */
export function makeTaggable(fn) {
    let currentTags = [];

    /** @type {T} */
    const taggedFn = (...args) => {
        const tags = currentTags;
        currentTags = [];

        return fn(...args, tags);
    };

    /** @type {T & { [key: string]: T }} */
    const tagProxy = new Proxy(taggedFn, {
        get(target, p) {
            currentTags.push(p);
            return tagProxy;
        },
        set() {},
    });

    return tagProxy;
}

/**
 * @param {unknown} value
 * @param {Matcher} matcher
 */
export function match(value, matcher) {
    if (typeof matcher === "string") {
        matcher = new RegExp(matcher, "i");
    }
    if (matcher instanceof RegExp) {
        return matcher.test(value);
    } else {
        return value instanceof matcher;
    }
}

/**
 * @template {any[]} T
 * @param {T} array
 */
export function shuffle(array) {
    const copy = [...array];
    let randIndex;
    for (let i = 0; i < copy.length; i++) {
        randIndex = Math.floor(Math.random() * copy.length);
        [copy[i], copy[randIndex]] = [copy[randIndex], copy[i]];
    }
    return copy;
}

/**
 * @param {"local" | "session"} type
 */
export function storage(type) {
    /**
     * @template T
     * @param {string} key
     * @param {T} defaultValue
     * @returns {T}
     */
    const get = (key, defaultValue) => {
        const value = s.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    };

    /**
     * @param  {...string} keys
     */
    const remove = (...keys) => {
        for (const key of keys) {
            s.removeItem(key);
        }
    };

    /**
     * @template T
     * @param {string} key
     * @param {T} value
     */
    const set = (key, value) => s.setItem(key, JSON.stringify(value));

    const s = type === "local" ? localStorage : sessionStorage;

    return { get, remove, set };
}

/**
 * @param {string} string
 */
export function stringToNumber(string) {
    let result = 0;
    for (let i = 0; i < string.length; i++) {
        result += string.charCodeAt(i);
    }
    return result;
}

/**
 * @param {string} string
 */
export function title(string) {
    return string[0].toUpperCase() + string.slice(1);
}

/**
 * @param {Element} element
 * @param {{ raw?: boolean }} [options]
 */
export function toSelector(element, options) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classNames = [...element.classList].map((className) => `.${className}`);
    if (options?.raw) {
        return { tagName, id, classNames };
    } else {
        return [tagName, id, ...classNames].join("");
    }
}

export const SPECIAL_TAGS = {
    debug: "debug",
    only: "only",
    skip: "skip",
};
