/** @odoo-module **/

import { isIterable, normalize, stringToNumber } from "../utils";

/**
 * @typedef {import("./suite").Suite} Suite
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {string} tagName
 */
const parseConfigTag = (tagName) => {
    const configParams = tagName.match(CONFIG_TAG_PATTERN);
    if (configParams) {
        const [, key, value] = configParams;
        const parser = CONFIG_TAGS[key];
        if (!parser) {
            throw new Error(`Invalid config tag: parameter "${key}" does not exist.`);
        }
        return { [key]: parser(value) };
    }
    return null;
};

const CONFIG_TAG_PATTERN = /^([\w-]+)=([\w-]+)$/;

const CONFIG_TAGS = {
    timeout: Number,
    multi: Number,
};

const SPECIAL_TAGS = {
    debug: "debug",
    only: "only",
    skip: "skip",
    todo: "todo",
};

const TAG_COLORS = [
    ["#f43f5e", "#ffe4e6"], // rose
    ["#10b981", "#d1fae5"], // emerald
    ["#3b82f6", "#dbeafe"], // blue
    ["#fbbf24", "#451a03"], // amber
    ["#a855f7", "#f3e8ff"], // purple
    ["#f97316", "#ffedd5"], // orange
];

/** @type {Record<string, Tag>} */
const existingTags = {};
let canCreateTag = false;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 *
 * @param {string | Tag} tagName
 */
export function createTag(tagName) {
    if (typeof tagName === "string") {
        if (!existingTags[tagName]) {
            canCreateTag = true;
            existingTags[tagName] = new Tag(tagName);
            canCreateTag = false;
        }
        return existingTags[tagName];
    } else if (tagName instanceof Tag) {
        return tagName;
    }
}

/**
 * @param  {...(string | Tag)[]} tagLists
 */
export function createTags(...tagLists) {
    /** @type {Tag[]} */
    const tags = [];
    for (const tagList of tagLists) {
        if (!isIterable(tagList)) {
            continue;
        }
        for (const tagName of tagList) {
            const tag = createTag(tagName);
            if (tag && !tags.includes(tag)) {
                tags.push(tag);
            }
        }
    }
    return tags;
}

/**
 * Cannot call the constructor outside of 'createTag'.
 * @see {createTag}
 */
export class Tag {
    static DEBUG = SPECIAL_TAGS.debug;
    static ONLY = SPECIAL_TAGS.only;
    static SKIP = SPECIAL_TAGS.skip;
    static TODO = SPECIAL_TAGS.todo;

    /**
     * @param {string} name
     */
    constructor(name) {
        if (!canCreateTag) {
            throw new Error(`Illegal constructor: use 'createTag' instead`);
        }

        this.name = name;

        this.id = this.name;
        this.index = normalize(this.name);

        this.special = this.name in SPECIAL_TAGS;
        this.config = parseConfigTag(this.name);
        this.color = TAG_COLORS[stringToNumber(this.id) % TAG_COLORS.length];
    }
}
