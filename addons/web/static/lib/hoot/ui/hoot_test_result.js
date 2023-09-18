/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Tag } from "../core/tag";
import { subscribeToURLParams, withParams } from "../core/url";
import { compactXML } from "../utils";
import { HootTechnicalValue } from "./hoot_technical_value";
import { HootTestPath } from "./hoot_test_path";

/**
 * @typedef {import("../core/test").Test} Test
 *
 * @typedef {{
 *  defaultOpen: boolean;
 *  test: Test;
 * }} TestResultProps
 */

/** @extends Component<TestResultProps, import("../setup").Environment> */
export class HootTestResult extends Component {
    static components = { HootTestPath, HootTechnicalValue };

    static template = compactXML/* xml */ `
        <details class="hoot-result hoot-col" t-att-class="className" t-att-open="props.defaultOpen">
            <summary class="hoot-result-header hoot-row hoot-text-md">
                <div class="hoot-row hoot-overflow-hidden hoot-gap-2">
                    <HootTestPath test="props.test" />
                    <div class="hoot-row hoot-gap-1">
                        <a
                            t-att-href="withParams('test', props.test.id)"
                            class="hoot-result-btn hoot-text-success hoot-px-1 hoot-py-0.5"
                            title="Run this test only"
                        >
                            <i class="bi bi-play-fill" />
                        </a>
                        <a
                            t-att-href="withParams('debugTest', props.test.id)"
                            class="hoot-result-btn hoot-text-success hoot-px-1 hoot-py-0.5"
                            title="Run this test only in debug mode"
                        >
                            <i class="bi bi-bug-fill" />
                        </a>
                        <t t-if="!props.test.skip or !props.test.hasTag(Tag.SKIP)">
                            <a
                                t-att-href="withParams('skip-test', props.test.id)"
                                class="hoot-result-btn hoot-text-info hoot-px-1 hoot-py-0.5"
                                t-att-title="props.test.skip ? 'Unskip test' : 'Skip test'"
                            >
                                <i t-attf-class="bi bi-{{ props.test.skip ? 'arrow-repeat' : 'fast-forward-fill' }}" />
                            </a>
                        </t>
                    </div>
                </div>
                <span
                    class="hoot-text-sm hoot-whitespace-nowrap"
                    t-attf-class="hoot-text-{{ props.test.skip ? 'info' : 'muted' }}"
                >
                    <t t-if="props.test.skip">
                        skipped
                    </t>
                    <t t-else="">
                        <t t-if="props.test.lastResults.aborted">
                            aborted after
                        </t>
                        <t t-esc="props.test.lastResults.duration" /> ms
                    </t>
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
                                    <HootTechnicalValue value="info[0]" />
                                    <HootTechnicalValue value="info[1]" />
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

    Tag = Tag;
    withParams = withParams;

    get className() {
        const { lastResults, skip } = this.props.test;
        if (lastResults.aborted) {
            return "hoot-abort";
        } else if (skip) {
            return "hoot-skip";
        } else if (lastResults.pass) {
            return "hoot-pass";
        } else {
            return "hoot-fail";
        }
    }

    setup() {
        subscribeToURLParams("*");
    }
}
