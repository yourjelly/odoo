/** @odoo-module */

import { makeCallbacks } from "../utils";
import { Job } from "./job";

/**
 * @typedef {import("./tag").Tag} Tag
 *
 * @typedef {import("./test").Test} Test
 */

export class Suite extends Job {
    callbacks = makeCallbacks();
    /** @type {Job[]} */
    jobs = [];

    /** @returns {boolean} */
    canRun() {
        return super.canRun() && this.jobs.every((job) => job.canRun());
    }
}
