/** @odoo-module **/

import { xml } from "@odoo/owl";
import {
    Boolean,
    clearTimeout,
    console,
    JSON,
    localStorage,
    navigator,
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
 * @param {string} text
 */
export async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
        log.debug(`Copied to clipboard:`, text);
    } catch (err) {
        log.warn("Could not copy to clipboard:", err);
    }
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
 * This function computes a score that represent the fact that the
 * string contains the pattern, or not
 *
 * - If the score is 0, the string does not contain the letters of the pattern in
 *   the correct order.
 * - if the score is > 0, it actually contains the letters.
 *
 * Better matches will get a higher score: consecutive letters are better,
 * and a match closer to the beginning of the string is also scored higher.
 *
 * @param {string} pattern (normalized)
 * @param {string} string (normalized)
 */
export function getFuzzyScore(pattern, string) {
    let totalScore = 0;
    let currentScore = 0;
    let patternIndex = 0;

    const length = string.length;
    for (let i = 0; i < length; i++) {
        if (string[i] === pattern[patternIndex]) {
            patternIndex++;
            currentScore += 100 + currentScore - i / 200;
        } else {
            currentScore = 0;
        }
        totalScore = totalScore + currentScore;
    }

    return patternIndex === pattern.length ? totalScore : 0;
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
    if (["group", "groupEnd", "table"].includes(firstTag)) {
        return logFn(...args);
    }
    const prefix = `%c[HOOT]%c`;
    const styles = [`color:#ff0080`, `color:inherit`];
    const firstArg = args.shift() ?? "";
    if (typeof firstArg === "string") {
        args.unshift(`${prefix} ${firstArg}`, ...styles);
    } else {
        args.unshift(prefix, ...styles, firstArg);
    }
    return logFn(...args);
});

/**
 * Returns a list of items that match the given pattern, ordered by their 'score'
 * (descending). A higher score means that the match is closer (e.g. consecutive
 * letters).
 *
 * @template T
 * @param {string} pattern
 * @param {Iterable<T>} items
 * @param {(item: T) => string} mapFn
 * @returns {T[]}
 */
export function lookup(pattern, items, mapFn = normalize) {
    const nPattern = parseRegExp(normalize(pattern));
    if (nPattern instanceof RegExp) {
        return [...items].filter((item) => nPattern.test(mapFn(item)));
    } else {
        // Fuzzy lookup
        const groupedByScore = {};
        for (const item of items) {
            const score = getFuzzyScore(nPattern, mapFn(item));
            if (score > 0) {
                if (!groupedByScore[score]) {
                    groupedByScore[score] = [];
                }
                groupedByScore[score].push(item);
            }
        }
        return Object.values(groupedByScore).flat().reverse();
    }
}

export function makeCallbacks() {
    /**
     * @param {string} type
     * @param {...((...args: any[]) => Promise<void>)} callbacks
     */
    const add = (type, ...callbacks) => {
        if (!callbackRegistry[type]) {
            callbackRegistry[type] = new Set();
        }
        for (const callback of callbacks) {
            callbackRegistry[type].add(callback);
        }
    };

    /**
     * @param {string} type
     * @param {...any} args
     */
    const call = async (type, ...args) => {
        if (!callbackRegistry[type]) {
            return;
        }
        const fns = [...callbackRegistry[type]];
        await Promise.all(fns.map((fn) => Promise.resolve(fn(...args)).catch(console.error)));
    };

    /**
     * @param {string} type
     * @param {...((...args: any[]) => Promise<void>)} callbacks
     */
    const remove = (type, ...callbacks) => {
        if (!callbackRegistry[type]) {
            return;
        }
        for (const callback of callbacks) {
            callbackRegistry[type].delete(callback);
        }
    };

    /** @type {Record<string, ((...args: any[]) => Promise<void>)[]>} */
    const callbackRegistry = {};

    return { add, call, remove };
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
 * @param {Matcher} [matcher]
 */
export function match(value, matcher) {
    if (!matcher) {
        return !value;
    }
    if (typeof matcher === "function") {
        matcher = new RegExp(matcher.name);
    } else if (typeof matcher === "string") {
        matcher = new RegExp(matcher, "i");
    }
    let strValue = String(value);
    if (strValue === "[object Object]") {
        strValue = value.constructor.name;
    }
    return matcher.test(strValue);
}

/**
 * @param {string} string
 */
export function normalize(string) {
    return string
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * @param {string} value
 */
export function parseRegExp(value) {
    const regexParams = value.match(REGEX_PATTERN);
    if (regexParams) {
        try {
            return new RegExp(regexParams[1], regexParams[2]);
        } catch (err) {
            if (match(err, SyntaxError)) {
                return value;
            } else {
                throw err;
            }
        }
    }
    return value;
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
