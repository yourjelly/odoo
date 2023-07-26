/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { clearInterval, performance, setInterval } from "../globals";
import { compactXML, formatMS } from "../utils";
import { HootTestPath } from "./hoot_test_path";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootStatusPanel extends Component {
    static components = { HootTestPath };

    static props = {
        filter: [
            { value: "failed" },
            { value: "passed" },
            { value: "skipped" },
            { value: "todo" },
            { value: null },
        ],
        filterResults: Function,
        grouped: Boolean,
        groupResults: Function,
        sorted: [{ value: "asc" }, { value: "desc" }, { value: false }],
        sortResults: Function,
    };

    static template = compactXML/* xml */ `
        <div class="hoot-status d-flex flex-row align-items-center gap-3" t-att-class="state.className">
            <div class="d-flex flex-row align-items-center gap-2">
                <span class="d-none d-md-block" t-esc="state.text" t-att-title="state.text" />
                <t t-if="state.runningTest">
                    <HootTestPath test="state.runningTest" />
                </t>
                <t t-if="state.timer !== null">
                    <span class="hoot-text-skip" t-attf-title="Running for {{ state.timer }} seconds">
                        (<t t-esc="state.timer" />s)
                    </span>
                </t>
            </div>
            <div class="d-flex flex-row align-items-center gap-1">
                <t t-if="state.passed">
                    <t t-set="color" t-value="!props.filter or props.filter === 'passed' ? 'pass' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} d-flex flex-row align-items-center gap-1 p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('passed')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.passed" />
                        <span class="d-none d-md-block">passed</span>
                    </button>
                </t>
                <t t-if="state.failed">
                    <t t-set="color" t-value="!props.filter or props.filter === 'failed' ? 'fail' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} d-flex flex-row align-items-center gap-1 p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('failed')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.failed" />
                        <span class="d-none d-md-block">failed</span>
                    </button>
                </t>
                <t t-if="state.skipped">
                    <t t-set="color" t-value="!props.filter or props.filter === 'skipped' ? 'skip' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} d-flex flex-row align-items-center gap-1 p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('skipped')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.skipped" />
                        <span class="d-none d-md-block">skipped</span>
                    </button>
                </t>
                <t t-if="state.todo">
                    <t t-set="color" t-value="!props.filter or props.filter === 'todo' ? 'todo' : 'muted'" />
                    <button
                        t-attf-class="hoot-text-{{ color }} d-flex flex-row align-items-center gap-1 p-1 hoot-transition-colors"
                        t-on-click="() => props.filterResults('todo')"
                    >
                        <span t-attf-class="hoot-bg-{{ color }} hoot-circle hoot-transition-colors" />
                        <t t-esc="state.todo" />
                        <span class="d-none d-md-block">todo</span>
                    </button>
                </t>
                <button
                    class="p-1"
                    t-att-class="{ 'hoot-text-primary': props.grouped }"
                    title="Group by suite"
                    t-on-click="props.groupResults"
                >
                    <i class="bi bi-list-nested" />
                </button>
                <button
                    class="p-1"
                    t-att-class="{ 'hoot-text-primary': props.sorted }"
                    title="Sort by duration"
                    t-on-click="props.sortResults"
                >
                    <i class="bi bi-filter" />
                </button>
            </div>
        </div>
    `;

    setup() {
        const startTimer = () => {
            if (runner.config.headless) {
                return;
            }
            stopTimer();
            currentTestStart = performance.now();
            intervalId = setInterval(() => {
                this.state.timer = Math.floor((performance.now() - currentTestStart) / 1000);
            }, 1000);
        };

        const stopTimer = () => {
            if (runner.config.headless) {
                return;
            }
            clearInterval(intervalId);
            this.state.timer = null;
        };

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
            passed: 0,
            skipped: 0,
            todo: 0,
            tests: 0,
        });

        let intervalId = 0;

        runner.beforeAll(() => {
            this.state.finished = false;
            start = performance.now();
        });

        runner.beforeAnyTest((test) => {
            this.state.runningTest = test;
            this.state.text = `Running`;
            this.state.timer = 0;

            startTimer();

            if (runner.debug) {
                this.state.text = `[DEBUG] ${this.state.text}`;
            }
        });

        runner.afterAnyTest(({ config, lastResults }) => {
            stopTimer();

            this.state.runningTest = null;
            this.state.tests++;
            this.state.done++;

            if (!lastResults.pass) {
                this.state.failed++;
            } else if (config.todo) {
                this.state.todo++;
            } else {
                this.state.passed++;
            }
        });

        runner.afterAnySkippedTest(() => {
            this.state.runningTest = null;
            this.state.skipped++;
        });

        runner.afterAll(() => {
            stopTimer();

            const { done } = this.state;
            const textParts = [`${done} test${done === 1 ? "" : "s"} completed`];
            textParts.push(`(total time: ${formatMS(performance.now() - start)})`);

            this.state.text = textParts.join(" ");
            this.state.finished = true;
        });
    }
}
