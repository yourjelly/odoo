/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { generateHash } from "../utils";

/**
 * @typedef {import("../assertions/assert").AssertMethods} AssertMethods
 *
 * @typedef {import("./suite").Suite} Suite
 *
 * @typedef {import("./tag").Tag} Tag
 */

export class Test {
    /** @type {Suite[]} */
    path = [this];

    /** @type {Tag[]} */
    tags = [];

    /** @type {Partial<import("../assertions/assert").Assert>} */
    lastResults = reactive({});

    /**
     * @param {Suite | null} parent
     * @param {string} name
     * @param {(assert: AssertMethods) => void | Promise<void>} runTest
     * @param {Tag[]} tags
     */
    constructor(parent, name, runTest, tags) {
        this.parent = parent || null;

        if (this.parent) {
            this.path.unshift(...this.parent.path);
        }

        this.name = name;
        this.fullName = this.path.map((suite) => suite.name).join(" > ");
        this.id = generateHash(this.fullName);

        this.run = runTest;
        this.skip = this.parent ? this.parent.skip : false;
        this.tags.push(...tags);
    }
}
