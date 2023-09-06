/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { SPECIAL_TAGS, generateHash } from "../utils";

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
    /** @type {Suite[]} */
    path = [this];
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

        if (this.parent) {
            Object.assign(this.config, this.parent.config);
            this.path.unshift(...this.parent.path);
        }

        this.name = name;
        this.fullName = this.path.map((suite) => suite.name).join(" > ");
        this.id = generateHash(this.fullName);

        this.runFn = runFn;
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
