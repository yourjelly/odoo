/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { isMarkupHelper } from "../assertions/assert_helpers";
import { compactXML } from "../utils";
import { HootStatusPanel } from "./hoot_status_panel";
import { HootTestResult } from "./hoot_test_result";
import { subscribeToURLParams } from "../core/url";

/**
 * @typedef {import("../core/test").Test} Test
 */

/**
 * @template T
 * @param {T[]} reactiveResults
 */
function makeResultBatcher(reactiveResults) {
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
        }, RENDER_INTERVAL);
    };

    let timeoutId = 0;

    /** @type {T[]} */
    let batchResults = [];

    return { add };
}

const RENDER_INTERVAL = 100;

/** @extends Component<{}, import("../setup").Environment> */
export class HootReporting extends Component {
    static components = { HootStatusPanel, HootTestResult };

    static template = compactXML/* xml */ `
        <div class="hoot-reporting hoot-col">
            <HootStatusPanel
                filter="state.filter"
                filterResults.bind="filterResults"
                sortResults.bind="sortResults"
            />
            <div class="hoot-results hoot-col">
                <t t-foreach="getFilteredResults()" t-as="test" t-key="test.id">
                    <HootTestResult test="test" defaultOpen="canOpen(test)" />
                </t>
            </div>
        </div>
    `;

    didShowDetail = !this.env.runner.config.showdetail;

    isMarkupHelper = isMarkupHelper;

    setup() {
        const { runner } = this.env;

        subscribeToURLParams("hideskipped", "showpassed");

        this.state = useState({
            filter: null,
            /** @type {Test[]} */
            results: [],
        });

        const { add } = makeResultBatcher(this.state.results);

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

    filterResults(filter) {
        this.state.filter = this.state.filter === filter ? null : filter;
    }

    getFilteredResults() {
        const { filter, results, sort } = this.state;
        const { hideskipped, showpassed } = this.env.runner.config;

        if (!filter && !sort && !hideskipped && showpassed) {
            return results;
        }

        const groups = sort ? {} : [];
        const [mapFn, ascending] = sort || [];
        for (const test of results) {
            let matchFilter = false;
            switch (filter) {
                case "failed":
                    matchFilter = !test.skip && !test.lastResults.pass;
                    break;
                case "passed":
                    matchFilter = !test.skip && test.lastResults.pass;
                    break;
                case "skipped":
                    matchFilter = test.skip;
                    break;
                default:
                    if (hideskipped && test.skip) {
                        matchFilter = false;
                    } else if (!showpassed && test.lastResults.pass) {
                        matchFilter = false;
                    } else {
                        matchFilter = true;
                    }
                    break;
            }
            if (!matchFilter) {
                continue;
            }
            if (sort) {
                const key = mapFn(test);
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(test);
            } else {
                groups.push(test);
            }
        }

        if (sort) {
            const values = Object.values(groups).flat();
            return ascending ? values : values.reverse();
        } else {
            return groups;
        }
    }

    sortResults(mapFn) {
        if (this.state.sort) {
            this.state.sort = this.state.sort[1] ? null : [mapFn, true];
        } else {
            this.state.sort = [mapFn, false];
        }
    }
}
