/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Date, clearInterval, setInterval } from "../globals";
import { compactXML } from "../utils";
import { HootTestPath } from "./hoot_test_path";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootStatusPanel extends Component {
    static components = { HootTestPath };

    static props = {
        filter: [String, { value: null }],
        filterResults: Function,
        sortResults: Function,
    };

    static template = compactXML/* xml */ `
        <div class="hoot-status hoot-row hoot-gap-3" t-att-class="state.className">
            <div class="hoot-row hoot-gap-2">
                <span class="hoot-hide-sm" t-esc="state.text" t-att-title="state.text" />
                <t t-if="state.runningTest">
                    <HootTestPath test="state.runningTest" />
                </t>
                <t t-if="state.timer !== null">
                    <span class="hoot-text-info" t-attf-title="Running for {{ state.timer }} seconds">
                        (<t t-esc="state.timer" />s)
                    </span>
                </t>
            </div>
            <div class="hoot-row hoot-gap-1">
                <t t-if="state.done - state.failed">
                    <t t-set="color" t-value="!props.filter or props.filter === 'passed' ? 'success' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} hoot-row hoot-gap-1 hoot-p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('passed')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.done - state.failed" /> passed
                    </button>
                </t>
                <t t-if="state.failed">
                    <t t-set="color" t-value="!props.filter or props.filter === 'failed' ? 'danger' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} hoot-row hoot-gap-1 hoot-p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('failed')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.failed" /> failed
                    </button>
                </t>
                <t t-if="state.skipped">
                    <t t-set="color" t-value="!props.filter or props.filter === 'skipped' ? 'info' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} hoot-row hoot-gap-1 hoot-p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('skipped')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.skipped" /> skipped
                    </button>
                </t>
                <button
                    title="Sort by time"
                    t-on-click="() => props.sortResults((test) => test.lastResults.duration or 0)"
                >
                    <i class="bi bi-filter" />
                </button>
            </div>
        </div>
    `;

    setup() {
        const { runner } = this.env;
        let start;
        let currentTestStart;
        this.state = useState({
            className: "",
            finished: false,
            /** @type {import("../core/test").Test | null} */
            runningTest: null,
            text: "Ready",
            timer: null,
            // reporting
            done: 0,
            failed: 0,
            skipped: 0,
            tests: 0,
        });

        let intervalId = 0;

        runner.beforeAll(() => {
            this.state.finished = false;
            start = Date.now();
        });

        runner.beforeAnyTest((test) => {
            currentTestStart = Date.now();

            this.state.runningTest = test;
            this.state.text = `Running`;
            this.state.timer = 0;

            intervalId = setInterval(() => {
                this.state.timer = Math.floor((Date.now() - currentTestStart) / 1000);
            }, 1000);

            if (runner.debug) {
                this.state.text = `[DEBUG] ${this.state.text}`;
            }
        });

        runner.afterAnyTest((test) => {
            clearInterval(intervalId);
            this.state.timer = null;

            this.state.runningTest = null;
            this.state.tests++;
            this.state.done++;

            if (!test.lastResults.pass) {
                this.state.failed++;
            }
        });

        runner.skippedAnyTest(() => {
            this.state.runningTest = null;
            this.state.skipped++;
        });

        runner.afterAll(() => {
            const { done } = this.state;
            const textParts = [`${done} test${done === 1 ? "" : "s"} completed`];
            textParts.push(`(total time: ${Date.now() - start} ms)`);

            this.state.text = textParts.join(" ");
            this.state.finished = true;
        });
    }

    start() {
        this.env.runner.start();
    }
}
