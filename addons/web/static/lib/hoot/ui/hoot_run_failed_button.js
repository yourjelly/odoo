/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { Boolean } from "../globals";
import { compactXML, storage } from "../utils";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootRunFailedButton extends Component {
    static template = compactXML/* xml */ `
        <t t-if="state.show">
            <a
                class="hoot-run-failed hoot-btn d-flex flex-row align-items-center p-2 gap-1"
                href=""
                t-on-click="onClick"
                title="Run failed"
            >
                Run failed
            </a>
        </t>
    `;

    setup() {
        const { runner } = this.env;
        const previousFails = storage("session").get("failed-tests", []);

        this.state = useState({
            failed: previousFails,
            show: Boolean(previousFails.length),
        });

        runner.afterAnyTest(({ id, lastResults }) => {
            if (!lastResults.pass) {
                this.state.failed.push(id);
            }
            this.state.show = Boolean(this.state.failed.length);
        });
    }

    onClick() {
        storage("session").set("failed-tests", this.state.failed);
    }
}
