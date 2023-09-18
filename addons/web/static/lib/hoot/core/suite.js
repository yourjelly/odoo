/** @odoo-module **/

import { generateHash, makeCallbacks, normalize } from "../utils";
import { Tag } from "./tag";

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
    skip = false;
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
        this.name = name;

        if (this.parent) {
            Object.assign(this.config, this.parent.config);
            this.path.unshift(...this.parent.path);
            this.skip = this.parent.skip;
        }

        this.fullName = this.path.map((job) => job.name).join(" > ");
        this.id = generateHash(this.fullName);
        this.index = normalize(this.fullName);

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

    /** @returns {boolean} */
    canRun() {
        return !this.skip && this.jobs.length && this.jobs.every((job) => job.canRun());
    }

    /** @param {string} tagName */
    hasTag(tagName) {
        return this.tagNames.has(tagName) || this.parent?.hasTag(tagName);
    }
}
