/** @odoo-module **/

import { generateHash, makeCallbacks } from "../utils";

/**
 * @typedef {import("./tag").Tag} Tag
 *
 * @typedef {import("./test").Test} Test
 */

export class Suite {
    /** @type {(Suite | Test)[]} */
    jobs = [];

    /** @type {Suite[]} */
    path = [this];

    callbacks = makeCallbacks();

    skip = false;
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
            this.path.unshift(...this.parent.path);
        }

        this.name = name;
        this.fullName = this.path.map((suite) => suite.name).join(" > ");
        this.id = generateHash(this.fullName);

        this.skip = this.parent ? this.parent.skip : false;
        this.tags.push(...tags);
    }
}
