/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Boolean } from "../globals";
import { compactXML, storage } from "../utils";
import { ICONS } from "./icons";

/** @extends Component<{}, import("../setup").Environment> */
export class RunFailedButton extends Component {
    static template = compactXML/* xml */ `
        <t t-if="state.show">
            <a
                class="hoot-run-failed hoot-btn hoot-row hoot-p-2 hoot-gap-1"
                href=""
                t-on-click="onClick"
                title="Run failed"
            >
                ${ICONS.fail}
                Run failed
            </a>
        </t>
    `;

    setup() {
        const { runner } = this.env;
        const previousFails = storage("session").get("hoot-failed-tests", []);

        this.state = useState({
            failed: previousFails,
            show: Boolean(previousFails.length),
        });

        runner.afterAnyTest((test) => {
            if (!test.lastResults.pass) {
                this.state.failed.push(test.id);
            }
        });

        runner.afterAll(() => {
            this.state.show = Boolean(this.state.failed.length);
        });
    }

    onClick() {
        storage("session").set("hoot-failed-tests", this.state.failed);
    }
}
