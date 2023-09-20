/** @odoo-module */

import { generateHash, normalize } from "../utils";

export class Job {
    /** @type {Record<string, any>} */
    config = {
        skip: false,
        todo: false,
    };
    /** @type {Job[]} */
    path = [this];
    /** @type {import("./tag").Tag[]} */
    specialTags = [];
    /** @type {Set<string>} */
    tagNames = new Set();
    /** @type {import("./tag").Tag[]} */
    tags = [];
    visited = 0;

    /**
     * @param {import("./suite").Suite | null} parent
     * @param {string} name
     * @param {() => void} fn
     * @param {import("./tag").Tag[]} tags
     */
    constructor(parent, name, fn, tags) {
        this.parent = parent || null;
        this.name = name;

        // Keeps the stack trace bound to the original 'fn'
        this.run = (...args) => fn(...args);

        if (this.parent) {
            Object.assign(this.config, this.parent.config);
            this.path.unshift(...this.parent.path);
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

    canRun() {
        return !this.config.skip;
    }

    /** @param {string} tagName */
    hasTag(tagName) {
        return this.tagNames.has(tagName) || this.parent?.hasTag(tagName);
    }
}
