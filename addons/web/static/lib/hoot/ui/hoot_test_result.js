/** @odoo-module */

import { Component } from "@odoo/owl";
import { Tag } from "../core/tag";
import { Test } from "../core/test";
import { subscribeToURLParams, withParams } from "../core/url";
import { compactXML, formatMS } from "../utils";
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

/** @extends Component<TestResultProps, import("../hoot").Environment> */
export class HootTestResult extends Component {
    static components = { HootTestPath, HootTechnicalValue };

    static props = {
        open: Boolean,
        test: Test,
    };

    static template = compactXML/* xml */ `
        <details
            class="hoot-result d-flex flex-column"
            t-att-class="className"
            t-att-open="props.open"
        >
            <summary class="hoot-result-header d-flex flex-row align-items-center">
                <div class="d-flex flex-row align-items-center overflow-hidden gap-2">
                    <HootTestPath test="props.test" />
                    <div class="d-flex flex-row align-items-center gap-1">
                        <a
                            t-att-href="withParams('test', props.test.id)"
                            class="hoot-result-btn hoot-text-pass px-1"
                            title="Run this test only"
                        >
                            <i class="bi bi-play-fill" />
                        </a>
                        <a
                            t-att-href="withParams('debugTest', props.test.id)"
                            class="hoot-result-btn hoot-text-pass px-1"
                            title="Run this test only in debug mode"
                        >
                            <i class="bi bi-bug-fill" />
                        </a>
                        <a
                            t-att-href="withParams('test', props.test.id, true)"
                            class="hoot-result-btn hoot-text-fail px-1"
                            title="Ignore test"
                        >
                            <i class="bi bi-ban" />
                        </a>
                    </div>
                </div>
                <small
                    class="text-nowrap"
                    t-attf-class="hoot-text-{{ props.test.config.skip ? 'skip' : 'muted' }}"
                >
                    <t t-if="props.test.config.skip">
                        skipped
                    </t>
                    <t t-else="">
                        <t t-if="props.test.lastResults.aborted">
                            aborted after
                        </t>
                        <t t-esc="formatMS(props.test.lastResults.duration)" />
                    </t>
                </small>
            </summary>
            <t t-if="!props.test.config.skip">
                <div class="hoot-result-detail d-grid gap-1 rounded overflow-x-auto p-1 m-2 mt-0">
                    <t t-set="lastResults" t-value="props.test.lastResults" />
                    <t t-foreach="lastResults.assertions" t-as="assertion" t-key="assertion.id">
                        <div
                            t-attf-class="hoot-result-line hoot-text-{{ assertion.pass ? 'pass' : 'fail' }} d-flex flex-row align-items-center gap-1 px-2 text-truncate"
                        >
                            <t t-esc="assertion_index + 1" />.
                            <strong class="hoot-text-skip" t-esc="assertion.name" />
                            <t t-esc="assertion.message" />
                        </div>
                        <t t-set="timestamp" t-value="assertion.ts - lastResults.ts" />
                        <small class="hoot-text-muted d-flex align-items-center" t-att-title="timestamp">
                            @<t t-esc="formatMS(timestamp)" />
                        </small>
                        <t t-if="!assertion.pass and assertion.info">
                            <t t-foreach="assertion.info" t-as="info" t-key="info_index">
                                <div class="hoot-info-line">
                                    <HootTechnicalValue value="info[0]" />
                                    <HootTechnicalValue value="info[1]" />
                                </div>
                            </t>
                        </t>
                    </t>
                    <t t-if="lastResults.error">
                        <div class="hoot-result-line d-flex flex-row align-items-center px-2 hoot-text-fail">
                            Error while running test "<t t-esc="props.test.name" />"
                        </div>
                        <div class="hoot-info-line">
                            <span class="hoot-text-fail ps-2">Source:</span>
                            <pre class="hoot-technical" t-esc="lastResults.error.stack" />
                        </div>
                    </t>
                </div>
            </t>
        </details>
    `;

    formatMS = formatMS;
    Tag = Tag;
    withParams = withParams;

    get className() {
        const { config, lastResults } = this.props.test;
        if (!lastResults || config.skip) {
            return "hoot-skip";
        } else if (lastResults.aborted) {
            return "hoot-abort";
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
