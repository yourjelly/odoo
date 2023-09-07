/** @odoo-module **/

import { Component } from "@odoo/owl";
import { subscribeToURLParams, withParams } from "../core/url";
import { compactXML } from "../utils";

/** @extends Component<{}, import("../setup").Environment> */
export class HootRunAllButton extends Component {
    static template = compactXML/* xml */ `
        <t t-if="env.runner.hasFilter">
            <a class="hoot-run-all hoot-btn hoot-p-2" t-att-href="withParams()">
                Run all
            </a>
        </t>
    `;

    withParams = withParams;

    setup() {
        const { runner, url } = this.env;
        subscribeToURLParams(...Object.keys(runner.config));
    }
}
