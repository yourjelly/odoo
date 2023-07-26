/** @odoo-module **/

import { App } from "@odoo/owl";
import { config as domConfig } from "../helpers/dom";
import { registerCleanup } from "../setup";
import { Main } from "../ui/main";

/**
 * @param {string} href
 */
export function mockLocation(href) {
    const a = document.createElement("a");
    a.href = href || "http://www.fake.url/tests/";
    return a;
}

/**
 * @param {ReturnType<import("../core/runner").makeTestRunner>} runner
 */
export async function mountRunner(runner) {
    const app = new App(Main, { env: { runner }, test: true });
    await app.mount(domConfig.defaultRoot);

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
