/** @odoo-module */

import { Component } from "@odoo/owl";
import { Test } from "../core/test";
import { withParams } from "../core/url";
import { compactXML } from "../utils";
import { HootCopyButton } from "./hoot_copy_button";
import { HootTagButton } from "./hoot_tag_button";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootTestPath extends Component {
    static components = { HootCopyButton, HootTagButton };

    static props = { test: Test };

    static template = compactXML/* xml */ `
        <t t-set="statusInfo" t-value="getStatusInfo()" />
        <span t-attf-class="hoot-circle hoot-bg-{{ statusInfo.className }}" t-att-title="statusInfo.text" />
        <span class="hoot-path d-flex flex-row align-items-center">
            <span class="hoot-suites d-flex flex-row align-items-center d-none d-md-flex">
                <t t-foreach="props.test.path.slice(0, -1)" t-as="suite" t-key="suite.id">
                    <a
                        t-att-href="withParams('suite', suite.id)"
                        class="hoot-result-button-text hoot-text-muted rounded fw-bold text-truncate d-flex flex-row align-items-center p-1"
                        t-att-class="{ 'hoot-text-skip': suite.config.skip }"
                        draggable="false"
                        t-attf-title='Run suite "{{ suite.name }}"'
                    >
                        <span class="hoot-text" t-esc="suite.name" />
                    </a>
                    <span t-att-class="{ 'hoot-text-skip': suite.config.skip }">/</span>
                </t>
            </span>
            <span
                class="hoot-test text-truncate fw-bold d-flex flex-row align-items-center gap-1 mx-1"
                t-att-class="{ 'hoot-text-skip': props.test.config.skip }"
                t-att-title="props.test.name"
                draggable="false"
            >
                <t t-esc="props.test.name" />
                <t t-if="!props.test.config.skip">
                    <t t-set="expectLength" t-value="props.test.lastResults?.assertions?.length or 0" />
                    <span class="user-select-none" t-attf-title="{{ expectLength }} assertions passed">
                        (<t t-esc="expectLength" />)
                    </span>
                </t>
            </span>
            <HootCopyButton text="props.test.name" />
            <t t-if="props.test.config.multi">
                <strong class="hoot-text-abort text-nowrap">
                    x<t t-esc="props.test.config.multi" />
                </strong>
            </t>
        </span>
        <t t-if="props.test.tags.length">
            <ul class="hoot-tags d-flex flex-row align-items-center m-0 list-unstyled">
                <t t-foreach="props.test.tags" t-as="tag" t-key="tag.id">
                    <li>
                        <HootTagButton tag="tag" />
                    </li>
                </t>
            </ul>
        </t>
    `;

    withParams = withParams;

    getStatusInfo() {
        const { config, lastResults } = this.props.test;
        if (!lastResults || config.skip) {
            return { className: "skip", text: "skipped" };
        } else if (lastResults.aborted) {
            return { className: "abort", text: "aborted" };
        } else if (config.todo) {
            return { className: "todo", text: "todo" };
        } else if (lastResults.pass) {
            return { className: "pass", text: "passed" };
        } else {
            return { className: "fail", text: "failed" };
        }
    }
}
