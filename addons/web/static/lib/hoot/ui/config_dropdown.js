/** @odoo-module **/

import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { compactXML } from "../utils";
import { ICONS } from "./icons";

/** @extends Component<{}, import("../setup").Environment> */
export class ConfigDropdown extends Component {
    static template = compactXML/* xml */ `
        <div class="hoot-config hoot-relative" t-ref="root">
            <button t-ref="toggler" class="hoot-btn hoot-p-2" title="Configuration">
                ${ICONS.gear}
            </button>
            <t t-if="state.open">
                <div class="hoot-dropdown">
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input type="checkbox" t-model="env.runner.config.showpassed" />
                        <span>Show passed tests</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.failfast"
                            t-on-change="env.url.refresh"
                        />
                        <span>Fail fast</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.notrycatch"
                            t-on-change="env.url.refresh"
                        />
                        <span>No try/catch</span>
                    </label>
                    <label class="hoot-checkbox hoot-dropdown-line">
                        <input
                            type="checkbox"
                            t-model="env.runner.config.randomorder"
                            t-on-change="env.url.refresh"
                        />
                        <span>Random order</span>
                    </label>
                </div>
            </t>
        </div>
    `;

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
