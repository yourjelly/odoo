/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { isMarkupHelper } from "../assertions/assert_helpers";
import { compactXML } from "../utils";
import { HootTestResult } from "./hoot_test_result";
import { subscribeToURLParams } from "../core/url";

/**
 * @typedef {import("../core/test").Test} Test
 */

/**
 * @template T
 * @param {T[]} reactiveResults
 * @param {number} interval
 */
function makeResultBatcher(reactiveResults, interval) {
    /**
     * @param {T} result
     */
    const add = (result) => {
        batchResults.push(result);
        if (timeoutId) {
            return;
        }
        timeoutId = setTimeout(() => {
            reactiveResults.push(...batchResults);
            batchResults = [];
            timeoutId = 0;
        }, interval);
    };

    let timeoutId = 0;

    /** @type {T[]} */
    let batchResults = [];

    return { add };
}

const RENDER_INTERVAL = 100;

/** @extends Component<{}, import("../setup").Environment> */
export class HootReporting extends Component {
    static components = { HootTestResult };

    static template = compactXML/* xml */ `
        <div class="hoot-reporting hoot-col">
            <t t-foreach="displayedTests" t-as="test" t-key="test.id">
                <HootTestResult test="test" index="testIndex" defaultOpen="canOpen(test)" />
            </t>
        </div>
    `;

    testIndex = 1;
    didShowDetail = !this.env.runner.config.showdetail;

    isMarkupHelper = isMarkupHelper;

    get displayedTests() {
        if (this.env.runner.config.showpassed) {
            return this.results;
        }
        return this.results.filter((test) => !test.lastResults.pass || test.skip);
    }

    setup() {
        const { runner } = this.env;

        subscribeToURLParams("*");

        /** @type {Test[]} */
        this.results = useState([]);

        // Batch results to avoid updating too frequently
        const { add } = makeResultBatcher(this.results, RENDER_INTERVAL);

        runner.afterAnyTest(add);
        runner.skippedAnyTest(add);
    }

    canOpen(test) {
        const { showdetail } = this.env.runner.config;
        if (!showdetail || (showdetail === "first-fail" && this.didShowDetail)) {
            return false;
        }
        if (!test.lastResults.pass && !test.skip) {
            this.didShowDetail = true;
            return true;
        }
    }
}
