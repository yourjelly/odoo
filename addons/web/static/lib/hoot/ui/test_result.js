/** @odoo-module **/

import { Component } from "@odoo/owl";
import { DEFAULT_CONFIG } from "../core/url";
import { compactXML } from "../utils";
import { ICONS } from "./icons";
import { TechnicalValue } from "./technical_value";
import { TestPath } from "./test_path";

/**
 * @typedef {import("../core/test").Test} Test
 *
 * @typedef {{
 *  defaultOpen: boolean;
 *  test: Test;
 * }} TestResultProps
 */

/** @extends Component<TestResultProps, import("../setup").Environment> */
export class TestResult extends Component {
    static components = { TestPath, TechnicalValue };

    static template = compactXML/* xml */ `
        <t t-set="statusInfo" t-value="getStatusInfo()" />
        <details class="hoot-result hoot-col" t-att-class="statusInfo.className" t-att-open="props.defaultOpen">
            <summary class="hoot-result-header hoot-row hoot-text-md">
                <div class="hoot-row hoot-overflow-hidden hoot-gap-2">
                    <span
                        class="hoot-circle"
                        t-attf-class="hoot-bg-{{ statusInfo.color }}"
                        t-att-title="statusInfo.text"
                    />
                    <TestPath test="props.test" />
                    <div class="hoot-row">
                        <a
                            t-att-href="env.url.withParams('test', props.test.id)"
                            class="hoot-result-button-icon hoot-row"
                            title="Run this test only"
                        >
                            ${ICONS.play}
                        </a>
                        <a
                            t-att-href="env.url.withParams('debugTest', props.test.id)"
                            class="hoot-result-button-icon hoot-row"
                            title="Run this test only in debug mode"
                        >
                            ${ICONS.bug}
                        </a>
                        <t t-if="!props.test.skip or !props.test.hasSkipTag()">
                            <a
                                t-att-href="env.url.withParams('skip-test', props.test.id)"
                                class="hoot-result-button-icon hoot-row"
                                t-att-title="props.test.skip ? 'Unskip test' : 'Skip test'"
                            >
                                ${ICONS.forward}
                            </a>
                        </t>
                    </div>
                </div>
                <span t-if="!props.test.skip" class="hoot-duration hoot-text-sm">
                    <t t-esc="props.test.lastResults.duration" /> ms
                </span>
            </summary>
            <t t-if="!props.test.skip">
                <div class="hoot-result-detail hoot-col">
                    <t t-foreach="props.test.lastResults.assertions" t-as="result" t-key="result.id">
                        <div class="hoot-result-line" t-att-class="result.pass ? 'hoot-text-success' : 'hoot-text-danger'">
                            <t t-esc="result_index + 1" />. <t t-esc="result.message" />
                        </div>
                        <t t-if="!result.pass and result.info">
                            <t t-foreach="result.info" t-as="info" t-key="info_index">
                                <div class="hoot-info-line">
                                    <TechnicalValue value="info[0]" />
                                    <TechnicalValue value="info[1]" />
                                </div>
                            </t>
                        </t>
                    </t>
                    <t t-if="props.test.lastResults.error">
                        <div class="hoot-result-line hoot-text-danger">
                            Error while running test "<t t-esc="props.test.name" />"
                        </div>
                        <div class="hoot-info-line">
                            <span class="hoot-text-danger">Source:</span>
                            <pre class="hoot-technical" t-esc="props.test.lastResults.error.stack" />
                        </div>
                    </t>
                </div>
            </t>
        </details>
    `;

    setup() {
        this.env.url.subscribe(...Object.keys(DEFAULT_CONFIG));
    }

    getStatusInfo() {
        const { aborted, pass } = this.props.test.lastResults;
        if (aborted) {
            return { color: "warn", className: "hoot-abort", text: "aborted" };
        } else if (this.props.test.skip) {
            return { color: "info", className: "hoot-skip", text: "skipped" };
        } else if (pass) {
            return { color: "success", className: "hoot-pass", text: "passed" };
        } else {
            return { color: "danger", className: "hoot-fail", text: "failed" };
        }
    }
}
