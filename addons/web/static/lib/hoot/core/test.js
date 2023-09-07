/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { SPECIAL_TAGS, generateHash, normalize } from "../utils";

/**
 * @typedef {import("../assertions/assert").AssertMethods} AssertMethods
 *
 * @typedef {import("./suite").Suite} Suite
 *
 * @typedef {import("./tag").Tag} Tag
 */

export class Test {
    /** @type {Record<string, any>} */
    config = {};
    /** @type {Partial<import("../assertions/assert").Assert>} */
    lastResults = reactive({});
    /** @type {(Suite | Test)[]} */
    path = [this];
    skip = false;
    /** @type {Tag[]} */
    specialTags = [];
    /** @type {Set<string>} */
    tagNames = new Set();
    /** @type {Tag[]} */
    tags = [];

    /**
     * @param {Suite | null} parent
     * @param {string} name
     * @param {(assert: AssertMethods) => any} runFn
     * @param {Tag[]} tags
     */
    constructor(parent, name, runFn, tags) {
        this.parent = parent || null;
        this.name = name;
        this.runFn = runFn;

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

    /**
     * @param {AssertMethods} assert
     */
    async run(assert) {
        await this.runFn(assert);
    }

    hasSkipTag() {
        return this.tagNames.has(SPECIAL_TAGS.skip) || this.parent?.hasSkipTag();
    }
}
