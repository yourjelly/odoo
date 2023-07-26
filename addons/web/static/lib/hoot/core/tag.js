/** @odoo-module **/

import { SPECIAL_TAGS, generateHash, isIterable, stringToNumber } from "../utils";

/**
 * @typedef {import("./suite").Suite} Suite
 */

const TAG_COLORS = [
    ["#f43f5e", "#ffe4e6"], // rose
    ["#10b981", "#d1fae5"], // emerald
    ["#3b82f6", "#dbeafe"], // blue
    ["#fbbf24", "#451a03"], // amber
    ["#a855f7", "#f3e8ff"], // purple
    ["#f97316", "#ffedd5"], // orange
];

export class Tag {
    /**
     * @param {string} name
     */
    constructor(name) {
        this.name = name;
        this.id = this.name;
        this.special = this.name in SPECIAL_TAGS;
        this.color = TAG_COLORS[stringToNumber(this.id) % TAG_COLORS.length];
    }
}

/**
 *
 * @param {string | Tag} tagName
 */
export function makeTag(tagName) {
    if (typeof tagName === "string") {
        if (!existingTags[tagName]) {
            existingTags[tagName] = new Tag(tagName);
        }
        return existingTags[tagName];
    } else if (tagName instanceof Tag) {
        return tagName;
    }
}

/**
 * @param  {...(string | Tag)[]} tagLists
 */
export function makeTags(...tagLists) {
    /** @type {Tag[]} */
    const tags = [];
    for (const tagList of tagLists) {
        if (!isIterable(tagList)) {
            continue;
        }
        for (const tagName of tagList) {
            const tag = makeTag(tagName);
            if (tag && !tags.includes(tag)) {
                tags.push(tag);
            }
        }
    }
    return tags;
}

/** @type {Record<string, Tag>} */
const existingTags = {};
