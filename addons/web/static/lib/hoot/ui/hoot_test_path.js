/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Test } from "../core/test";
import { compactXML, copy } from "../utils";
import { HootCopyButton } from "./hoot_copy_button";
import { HootTagButton } from "./hoot_tag_button";
import { withParams } from "../core/url";

/** @extends Component<{}, import("../setup").Environment> */
export class HootTestPath extends Component {
    static components = { HootCopyButton, HootTagButton };

    static props = { test: Test };

    static template = compactXML/* xml */ `
        <t t-set="statusInfo" t-value="getStatusInfo()" />
        <span class="hoot-circle" t-att-class="statusInfo.className" t-att-title="statusInfo.text" />
        <span class="hoot-path hoot-row">
            <span class="hoot-suites hoot-row hoot-hide-sm">
                <t t-foreach="props.test.path.slice(0, -1)" t-as="suite" t-key="suite.id">
                    <a
                        t-att-href="withParams('suite', suite.id)"
                        class="hoot-suite hoot-truncate hoot-result-button-text hoot-text-muted hoot-row hoot-p-1"
                        t-att-class="{ 'hoot-skipped': suite.skip }"
                        draggable="false"
                        t-attf-title='Run suite "{{ suite.name }}"'
                    >
                        <i class="bi bi-play-fill" />
                        <span class="hoot-text" t-esc="suite.name" />
                    </a>
                    <span class="hoot-mx-1" t-att-class="{ 'hoot-skipped': suite.skip }">&gt;</span>
                </t>
            </span>
            <span
                class="hoot-test hoot-truncate hoot-row hoot-gap-1"
                t-att-class="{ 'hoot-skipped': props.test.skip }"
                t-att-title="props.test.name"
                draggable="false"
            >
                <t t-esc="props.test.name" />
                <t t-if="!props.test.skip">
                    <t t-set="expectLength" t-value="props.test.lastResults.assertions?.length or 0" />
                    <span class="hoot-select-none" t-attf-title="{{ expectLength }} assertions passed">
                        (<t t-esc="expectLength" />)
                    </span>
                </t>
                <HootCopyButton text="props.test.name" />
            </span>
        </span>
        <t t-if="props.test.tags.length">
            <ul class="hoot-tags hoot-row">
                <t t-foreach="props.test.tags" t-as="tag" t-key="tag.id">
                    <li>
                        <HootTagButton tag="tag" />
                    </li>
                </t>
            </ul>
        </t>
    `;

    copy = copy;
    withParams = withParams;

    getStatusInfo() {
        const { lastResults, skip } = this.props.test;
        if (lastResults.aborted) {
            return { className: "hoot-bg-warn", text: "aborted" };
        } else if (skip) {
            return { className: "hoot-bg-info", text: "skipped" };
        } else if (lastResults.pass) {
            return { className: "hoot-bg-success", text: "passed" };
        } else {
            return { className: "hoot-bg-danger", text: "failed" };
        }
    }
}
