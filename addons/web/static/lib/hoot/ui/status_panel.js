/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Date } from "../globals";
import { compactXML, log } from "../utils";
import { TestPath } from "./test_path";

/** @extends Component<{}, import("../setup").Environment> */
export class StatusPanel extends Component {
    static components = { TestPath };

    static template = compactXML/* xml */ `
        <div class="hoot-status hoot-row hoot-gap-2" t-att-class="state.className">
            <span class="hoot-hide-sm" t-esc="state.text" t-att-title="state.text" />
            <t t-if="state.runningTest">
                <TestPath test="state.runningTest" />
            </t>
            <t t-if="state.finished">
                <span class="hoot-row hoot-gap-1 hoot-text-success">
                    <span class="hoot-circle hoot-bg-success" />
                    <t t-esc="state.done - state.failed" /> passed
                </span>
                <t t-if="state.failed">
                    <span class="hoot-row hoot-gap-1 hoot-text-danger">
                        <span class="hoot-circle hoot-bg-danger" />
                        <t t-esc="state.failed" /> failed
                    </span>
                </t>
                <t t-if="state.skipped">
                    <span class="hoot-row hoot-gap-1 hoot-text-warn">
                        <span class="hoot-circle hoot-bg-warn" />
                        <t t-esc="state.skipped" /> skipped
                    </span>
                </t>
            </t>
        </div>
    `;

    setup() {
        const { runner } = this.env;
        let start;
        let currentSuiteFailed = 0;
        let currentSuitePassed = 0;
        let currentSuiteSkipped = 0;
        this.state = useState({
            className: "",
            finished: false,
            /** @type {import("../core/test").Test | null} */
            runningTest: null,
            text: "Ready",
            // reporting
            suites: 0,
            tests: 0,
            failed: 0,
            skipped: 0,
            done: 0,
        });

        runner.beforeAll(() => {
            this.state.finished = false;
            start = Date.now();
        });

        runner.beforeAnyTest((test) => {
            this.state.runningTest = test;
            this.state.text = `Running`;
            if (runner.debug) {
                this.state.text = `[DEBUG] ${this.state.text}`;
            }
        });

        runner.afterAnyTest((test) => {
            this.state.runningTest = null;
            this.state.tests++;
            this.state.done++;
            if (test.lastResults.pass) {
                currentSuitePassed++;
            } else {
                currentSuiteFailed++;
                this.state.failed++;
            }
        });

        runner.skippedAnyTest(() => {
            this.state.runningTest = null;
            this.state.skipped++;
            currentSuiteSkipped++;
        });

        runner.afterAnySuite((suite) => {
            if (currentSuitePassed + currentSuiteFailed > 0) {
                this.state.suites++;
            }

            const logArgs = [`Suite "${suite.fullName}"`];
            if (currentSuitePassed) {
                logArgs.push("passed", currentSuitePassed, "tests");
            } else {
                logArgs.push("ended");
            }
            if (currentSuiteFailed) {
                logArgs.push("with", currentSuiteFailed, "failed tests");
            }
            if (currentSuiteSkipped) {
                logArgs.push("with", currentSuiteSkipped, "failed tests");
            }

            log(...logArgs);

            currentSuiteFailed = 0;
            currentSuitePassed = 0;
            currentSuiteSkipped = 0;
        });

        runner.afterAll(() => {
            const { done } = this.state;
            const textParts = [`${done} test${done.length === 1 ? "" : "s"} completed`];
            if (runner.hasFilter) {
                textParts.push(`in ${this.state.suites} suites`);
            }
            textParts.push(`(total time: ${Date.now() - start} ms)`);

            this.state.text = textParts.join(" ");
            this.state.finished = true;
        });
    }

    start() {
        this.env.runner.start();
    }
}
