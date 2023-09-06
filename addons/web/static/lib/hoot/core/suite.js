/** @odoo-module **/

import { SPECIAL_TAGS, generateHash, makeCallbacks } from "../utils";

/**
 * @typedef {import("./tag").Tag} Tag
 *
 * @typedef {import("./test").Test} Test
 */

export class Suite {
    callbacks = makeCallbacks();
    /** @type {Record<string, any>} */
    config = {};
    /** @type {(Suite | Test)[]} */
    jobs = [];
    /** @type {Suite[]} */
    path = [this];
    /** @type {Tag[]} */
    specialTags = [];
    /** @type {Set<string>} */
    tagNames = new Set();
    /** @type {Tag[]} */
    tags = [];
    visited = 0;

    /**
     * @param {Suite | null} parent
     * @param {string} name
     * @param {Tag[]} tags
     */
    constructor(parent, name, tags) {
        this.parent = parent || null;

        if (this.parent) {
            Object.assign(this.config, this.parent.config);
            this.path.unshift(...this.parent.path);
        }

        this.name = name;
        this.fullName = this.path.map((suite) => suite.name).join(" > ");
        this.id = generateHash(this.fullName);

        this.skip = this.parent ? this.parent.skip : false;
        for (const tag of tags) {
            if (tag.special) {
                this.specialTags.push(tag);
            } else if (tag.config) {
                Object.assign(this.config, tag.config);
            } else {
                this.tags.push(tag);
            }
            this.tagNames.add(tag.name);
        }
    }

    hasSkipTag() {
        return this.tagNames.has(SPECIAL_TAGS.skip) || this.parent?.hasSkipTag();
    }
}
