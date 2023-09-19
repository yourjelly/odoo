/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { subscribeToURLParams } from "../core/url";
import { isMarkupHelper } from "../matchers/expect_helpers";
import { compactXML, debounce } from "../utils";
import { HootStatusPanel } from "./hoot_status_panel";
import { HootTestResult } from "./hoot_test_result";

/**
 * @typedef {import("../core/test").Test} Test
 */

/**
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} interval
 * @returns {T}
 */
function batch(fn, interval) {
    /** @type {T[]} */
    const currentBatch = [];
    const name = `${fn.name} (batched)`;
    let timeoutId = 0;
    return {
        [name](...args) {
            currentBatch.push(() => fn(...args));
            if (timeoutId) {
                return;
            }
            timeoutId = setTimeout(() => {
                while (currentBatch.length) {
                    currentBatch.pop()();
                }
                timeoutId = 0;
            }, interval);
        },
    }[name];
}

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
            <div class="hoot-results">
                <t t-foreach="getFilteredResults()" t-as="test" t-key="test.id">
                    <HootTestResult test="test" open="state.open.includes(test.id)" />
                </t>
            </div>
        </div>
    `;

    isMarkupHelper = isMarkupHelper;
    debouncedOnScroll = debounce(() => this.onScroll(), 16);

    setup() {
        const { runner } = this.env;

        subscribeToURLParams("showskipped", "showpassed");

        this.state = useState({
            filter: null,
            /** @type {string[]} */
            open: [],
            /** @type {[(test: Test) => number, boolean] | null} */
            sort: null,
            /** @type {Test[]} */
            tests: [],
        });

        const addTest = batch((test) => this.state.tests.push(test), 100);

        let didShowDetail = false;
        const { showdetail } = this.env.runner.config;
        runner.afterAnyTest((test) => {
            addTest(test);
            if (
                showdetail &&
                !(showdetail === "first-fail" && didShowDetail) &&
                !test.skip &&
                !test.lastResults.pass
            ) {
                didShowDetail = true;
                this.state.open.push(test.id);
            }
        });
        runner.skippedAnyTest(addTest);
    }

    filterResults(filter) {
        this.state.filter = this.state.filter === filter ? null : filter;
    }

    getFilteredResults() {
        const { filter, sort, tests } = this.state;
        const { showskipped, showpassed } = this.env.runner.config;

        const groups = sort ? {} : [];
        const [mapFn, ascending] = sort || [];
        for (const test of tests) {
            let matchFilter = false;
            switch (filter) {
                case "failed": {
                    matchFilter = !test.skip && !test.lastResults.pass;
                    break;
                }
                case "passed": {
                    matchFilter = !test.skip && test.lastResults.pass;
                    break;
                }
                case "skipped": {
                    matchFilter = test.skip;
                    break;
                }
                default: {
                    if (!showskipped && test.skip) {
                        matchFilter = false;
                    } else if (!showpassed && test.lastResults.pass) {
                        matchFilter = false;
                    } else {
                        matchFilter = true;
                    }
                    break;
                }
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
