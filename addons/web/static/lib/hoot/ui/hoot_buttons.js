/** @odoo-module */

import { Component, useState, xml } from "@odoo/owl";
import { Test } from "../core/test";
import { refresh, subscribeToURLParams } from "../core/url";
import { HootLink } from "./hoot_link";

/**
 * @typedef {{}} HootButtonsProps
 */

/** @extends {Component<HootButtonsProps, import("../hoot").Environment>} */
export class HootButtons extends Component {
    static components = { HootLink };

    static props = {};

    static template = xml`
        <div class="hoot-buttons d-flex overflow-hidden">
            <t t-set="isRunning" t-value="runnerState.status === 'running'" />
            <button
                class="hoot-btn hoot-btn-primary d-flex align-items-center gap-2 px-2 py-1"
                t-on-click="onRunClick"
                t-att-title="isRunning ? 'Stop' : 'Run'"
            >
                <i t-attf-class="fa fa-{{ isRunning ? 'stop' : 'play' }}" />
                <span class="d-none d-sm-inline" t-esc="isRunning ? 'Stop' : 'Run'" />
            </button>
            <t t-if="state.failed.length">
                <HootLink
                    type="'test'"
                    id="state.failed"
                    class="'hoot-run-failed hoot-btn hoot-btn-primary px-2 py-1'"
                    title="'Run failed tests'"
                >
                    Run failed
                </HootLink>
            </t>
            <t t-if="env.runner.hasFilter">
                <HootLink class="'hoot-run-all hoot-btn hoot-btn-primary px-2 py-1'">
                    Run all
                </HootLink>
            </t>
        </div>
    `;

    setup() {
        const { runner } = this.env;
        this.state = useState({
            failed: [],
        });
        this.runnerState = useState(runner.state);

        runner.afterEach(({ id, status }) => {
            if (status !== Test.PASSED) {
                this.state.failed.push(id);
            }
        });

        subscribeToURLParams(...Object.keys(runner.config));
    }

    onRunClick() {
        const { runner } = this.env;
        switch (runner.state.status) {
            case "done": {
                refresh();
                break;
            }
            case "ready": {
                if (runner.config.manual) {
                    runner.start();
                } else {
                    refresh();
                }
                break;
            }
            case "running": {
                runner.stop();
                break;
            }
        }
    }
}
