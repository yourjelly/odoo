/** @odoo-module */

import { mount, whenReady } from "@odoo/owl";
import { patchWindow } from "../mock/window";
import { HootMain } from "./hoot_main";

//-----------------------------------------------------------------------------
// Global
//-----------------------------------------------------------------------------

const { customElements, document, HTMLElement } = globalThis;

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

class OdooHoot extends HTMLElement {
    static TAG_NAME = "odoo-hoot";

    constructor() {
        super();

        this.attachShadow({ mode: "open" });
    }
}

customElements.define(OdooHoot.TAG_NAME, OdooHoot);

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {import("../core/runner").TestRunner} runner
 */
export function setupHootUI(runner) {
    // - Patch window before code from other modules is executed
    patchWindow();

    // - Mount the main UI component
    whenReady(() => {
        const container = document.createElement(OdooHoot.TAG_NAME);
        document.body.appendChild(container);

        mount(HootMain, document.body, {
            dev: true, // TODO: remove when lib is stable
            env: { runner },
            name: "HOOT",
        });
    });
}
