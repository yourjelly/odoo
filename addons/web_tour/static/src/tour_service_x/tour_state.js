/* @odoo-module */

import { browser } from "@web/core/browser/browser";

const BOOLEAN = {
    toLocalStorage: (val) => (val ? "1" : "0"),
    fromLocalStorage: (val) => (val === "1" ? true : false),
};

const INTEGER = {
    toLocalStorage: (val) => val.toString(),
    fromLocalStorage: (val) => parseInt(val, 10),
};

const STRING = {
    toLocalStorage: (x) => x,
    fromLocalStorage: (x) => x,
};

const ALLOWED_KEYS = {
    watch: BOOLEAN,
    done: BOOLEAN,
    currentIndex: INTEGER,
    stepDelay: INTEGER,
    mode: STRING,
    navigated: BOOLEAN,
};

function getPrefixedName(tourName, key) {
    return `tour__${tourName}__${key}`;
}

function destructurePrefixedName(prefixedName) {
    const match = prefixedName.match(/tour__([.\w]+)__([\w]+)/);
    return match ? [match[1], match[2]] : null;
}

/**
 * Wrapper around localStorage for basic persistence of running tours.
 * Useful for resuming running tours when the page refreshed.
 * TODO-JCB: Needs further cleanup. There might be keys that are not needed.
 */
export const tourState = {
    get(tourName, key) {
        if (!(key in ALLOWED_KEYS)) {
            throw new Error(`Invalid key: '${key}' (tourName = '${tourName}')`);
        }
        const prefixedName = getPrefixedName(tourName, key);
        const savedValue = browser.localStorage.getItem(prefixedName);
        return ALLOWED_KEYS[key].fromLocalStorage(savedValue);
    },
    set(tourName, key, value) {
        if (!(key in ALLOWED_KEYS)) {
            throw new Error(`Invalid key: '${key}' (tourName = '${tourName}')`);
        }
        const prefixedName = getPrefixedName(tourName, key);
        browser.localStorage.setItem(prefixedName, ALLOWED_KEYS[key].toLocalStorage(value));
    },
    getActiveTours() {
        const activeTourNames = Object.keys(browser.localStorage)
            .map((key) => destructurePrefixedName(key))
            .filter((ds) => (ds ? ds[1] === "done" : false))
            .map((ds) => ds[0]);
        return activeTourNames.filter((tourName) => !this.get(tourName, "done"));
    },
    reset(tourName, obj) {
        for (const key in ALLOWED_KEYS) {
            if (key in obj) {
                this.set(tourName, key, obj[key]);
            }
        }
        this.set(tourName, "currentIndex", 0);
        this.set(tourName, "done", false);
    },
};
