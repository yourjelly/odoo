/** @odoo-module **/

import { Component } from "@odoo/owl";
import { compactXML } from "../utils";

/** @extends Component<{}, import("../setup").Environment> */
export class RunAllButton extends Component {
    static template = compactXML/* xml */ `
        <t t-if="env.runner.hasFilter">
            <a class="hoot-run-all hoot-btn hoot-p-2" t-att-href="env.url.withParams()">
                Run all
            </a>
        </t>
    `;

    setup() {
        const { runner, url } = this.env;
        url.subscribe(...Object.keys(runner.config));
    }
}
