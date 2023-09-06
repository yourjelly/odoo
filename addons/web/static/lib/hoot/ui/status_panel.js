/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Date } from "../globals";
import { compactXML } from "../utils";
import { TestPath } from "./test_path";

/** @extends Component<{}, import("../setup").Environment> */
export class StatusPanel extends Component {
    static components = { TestPath };

    static template = compactXML/* xml */ `
        <div class="hoot-status hoot-row hoot-gap-3" t-att-class="state.className">
            <div class="hoot-row hoot-gap-2">
                <span class="hoot-hide-sm" t-esc="state.text" t-att-title="state.text" />
                <t t-if="state.runningTest">
                    <TestPath test="state.runningTest" />
                </t>
            </div>
            <ul class="hoot-row hoot-gap-1">
                <t t-if="state.done">
                    <li class="hoot-row hoot-text-success hoot-gap-1 hoot-p-1">
                        <span class="hoot-circle hoot-bg-success" />
                        <t t-esc="state.done - state.failed" /> passed
                    </li>
                </t>
                <t t-if="state.failed">
                    <li class="hoot-row hoot-text-danger hoot-gap-1 hoot-p-1">
                        <span class="hoot-circle hoot-bg-danger" />
                        <t t-esc="state.failed" /> failed
                    </li>
                </t>
                <t t-if="state.skipped">
                    <li class="hoot-row hoot-text-info hoot-gap-1 hoot-p-1">
                        <span class="hoot-circle hoot-bg-info" />
                        <t t-esc="state.skipped" /> skipped
                    </li>
                </t>
            </ul>
        </div>
    `;

    setup() {
        const { runner } = this.env;
        let start;
        this.state = useState({
            className: "",
            finished: false,
            /** @type {import("../core/test").Test | null} */
            runningTest: null,
            text: "Ready",
            // reporting
            done: 0,
            failed: 0,
            skipped: 0,
            tests: 0,
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
