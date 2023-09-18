/** @odoo-module **/

import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { compactXML } from "../utils";
import { refresh } from "../core/url";

/** @extends Component<{}, import("../setup").Environment> */
export class HootConfigDropdown extends Component {
    static props = {
        colorToggle: Function,
        colorScheme: String,
    };

    static template = compactXML/* xml */ `
        <div class="hoot-config hoot-relative" t-ref="root">
            <button t-ref="toggler" class="hoot-btn hoot-p-2" title="Configuration">
                <i class="bi bi-gear-fill" />
            </button>
            <t t-if="state.open">
                <div class="hoot-dropdown">
                    <label
                        class="hoot-checkbox hoot-dropdown-line"
                        title="Display the tests that passed in the list of test results"
                    >
                        <input type="checkbox" t-model="env.runner.config.showpassed" />
                        <span>Show passed tests</span>
                    </label>
                    <label
                        class="hoot-checkbox hoot-dropdown-line"
                        title="Hide all tests that have been skipped"
                    >
                        <input type="checkbox" t-model="env.runner.config.hideskipped" />
                        <span>Hide skipped tests</span>
                    </label>
                    <label
                        class="hoot-checkbox hoot-dropdown-line"
                        title="Re-run current tests without catching any errors"
                    >
                        <input
                            type="checkbox"
                            t-model="env.runner.config.notrycatch"
                            t-on-change="refresh"
                        />
                        <span>No try/catch</span>
                    </label>
                    <label
                        class="hoot-checkbox hoot-dropdown-line"
                        title="Re-run current tests after shuffling them in a non-deterministic order"
                    >
                        <input
                            type="checkbox"
                            t-model="env.runner.config.randomorder"
                            t-on-change="refresh"
                        />
                        <span>Random order</span>
                    </label>
                    <label
                        class="hoot-checkbox hoot-dropdown-line"
                        title="Re-run current tests in headless mode (no UI)"
                    >
                        <input
                            type="checkbox"
                            t-model="env.runner.config.headless"
                            t-on-change="refresh"
                        />
                        <span>Headless</span>
                    </label>
                    <div
                        class="hoot-dropdown-line hoot-row hoot-gap-1"
                        title="Re-run current tests and abort after a given amount of failed tests"
                    >
                        <span>Bail after</span>
                        <input
                            type="number"
                            min="0"
                            class="hoot-w-1/4"
                            t-model.number="env.runner.config.bail"
                            t-on-change="refresh"
                        />
                        <span>failed tests</span>
                    </div>
                    <button
                        class="hoot-dropdown-line hoot-row hoot-gap-1"
                        title="Toggle the color scheme of the UI"
                        t-on-click="props.colorToggle"
                    >
                        <i t-attf-class="bi bi-{{ props.colorScheme === 'light' ? 'moon' : 'sun' }}-fill" />
                        Color scheme
                    </button>
                </div>
            </t>
        </div>
    `;

    refresh = refresh;

    setup() {
        this.rootRef = useRef("root");
        this.togglerRef = useRef("toggler");
        this.state = useState({ open: false });

        useExternalListener(window, "click", (ev) => {
            if (!this.rootRef.el?.contains(ev.target)) {
                this.state.open = false;
            } else if (this.togglerRef.el?.contains(ev.target)) {
                this.state.open = !this.state.open;
            }
        });
    }
}
