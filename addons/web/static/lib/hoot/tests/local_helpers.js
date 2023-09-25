/** @odoo-module */

import { App, Component, xml } from "@odoo/owl";
import { getFixture } from "../helpers/dom";
import { registerCleanup } from "../hoot";

/**
 * @param {import("@odoo/owl").ComponentConstructor | string} component
 * @param {any} appConfig
 */
export async function mount(component, appConfig) {
    if (typeof component === "string") {
        component = class extends Component {
            static template = xml`${component}`;
        };
    }

    const app = new App(component, { ...appConfig, test: true });
    await app.mount(getFixture());

    registerCleanup(() => app.destroy());
}

/**
 * @param {Partial<Window>} values
 */
export function patchWindow(values) {
    const original = {};
    for (const [key, value] of Object.entries(values)) {
        original[key] = window[key];
        window[key] = value;
    }
    registerCleanup(() => Object.assign(window, original));
}
