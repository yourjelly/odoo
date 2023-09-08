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
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input type="checkbox" t-model="env.runner.config.showpassed" />
                        <span>Show passed tests</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input type="checkbox" t-model="env.runner.config.hideskipped" />
                        <span>Hide skipped tests</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.failfast"
                            t-on-change="refresh"
                        />
                        <span>Fail fast</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.notrycatch"
                            t-on-change="refresh"
                        />
                        <span>No try/catch</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.randomorder"
                            t-on-change="refresh"
                        />
                        <span>Random order</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.headless"
                            t-on-change="refresh"
                        />
                        <span>Headless</span>
                    </label>
                    <button class="hoot-dropdown-line hoot-row hoot-gap-1" t-on-click="props.colorToggle">
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
