/** @odoo-module **/

import { App } from "@odoo/owl";
import { getFixture } from "../helpers/dom";
import { registerCleanup } from "../setup";

/**
 * @param {string} href
 */
export function mockLocation(href) {
    const a = document.createElement("a");
    a.href = href || "http://www.fake.url/tests/";
    return a;
}

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
