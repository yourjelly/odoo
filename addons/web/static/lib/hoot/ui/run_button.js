/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { compactXML } from "../utils";
import { ICONS } from "./icons";

/** @extends Component<{}, import("../setup").Environment> */
export class RunButton extends Component {
    static template = compactXML/* xml */ `
        <button
            class="hoot-abort hoot-btn hoot-row hoot-p-2 hoot-gap-1"
            t-on-click="onClick"
            t-att-title="state.text"
        >
            <t t-out="state.icon" />
            <t t-esc="state.text" />
        </button>
    `;

    setup() {
        const { runner } = this.env;
        this.state = useState({
            text: "Start",
            icon: ICONS.play,
        });

        runner.beforeAll(() => {
            this.state.text = "Abort";
            this.state.icon = ICONS.stop;
        });

        runner.afterAll(() => {
            this.state.text = "Run";
            this.state.icon = ICONS.play;
        });
    }

    onClick() {
        const { runner, url } = this.env;
        if (runner.status === "ready") {
            if (runner.config.autostart) {
                url.refresh();
            } else {
                runner.start();
            }
        } else {
            runner.stop();
        }
    }
}
