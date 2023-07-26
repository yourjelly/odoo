/** @odoo-module */

import { reactive } from "@odoo/owl";
import { Job } from "./job";

export class Test extends Job {
    /** @type {Partial<import("./expect").CurrentResults>[]} */
    results = reactive([]);

    /** @returns {typeof Test["prototype"]["results"][number]} */
    get lastResults() {
        return this.results.at(-1);
    }
}
