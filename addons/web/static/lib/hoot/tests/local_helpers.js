/** @odoo-module */

import { after } from "@odoo/hoot";
import { queryAll } from "@odoo/hoot-dom";
import { App, Component, xml } from "@odoo/owl";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Mounts a given component to the test fixture.
 *
 * By default, a `MainComponentsContainer` component is also mounted to the
 * fixture if none is found in the component tree (this can be overridden by the
 * `noMainContainer` option).
 *
 * @template {import("@odoo/owl").ComponentConstructor<P, E>} C
 * @template [P={}]
 * @template [E={}]
 * @param {C | string} ComponentClass
 * @param {{
 *  env?: E;
 *  props?: P;
 *  target?: HTMLElement;
 * }} [options]
 */
export async function mountWithCleanup(ComponentClass, options) {
    if (typeof ComponentClass === "string") {
        ComponentClass = class TestComponent extends Component {
            static props = {};
            static template = xml`${ComponentClass}`;
        };
    }

    const app = new App(ComponentClass, {
        env: options?.env,
        name: `TEST: ${ComponentClass.name}`,
        props: options?.props,
        test: true,
        warnIfNoStaticProps: true,
    });

    after(() => app.destroy());

    return app.mount(options?.target || document.body);
}

/**
 * @param {string} url
 */
export function parseUrl(url) {
    return url.replace(/^.*hoot\/tests/, "@hoot").replace(/(\.test)?\.js$/, "");
}

export function waitForIframes() {
    return Promise.all(
        queryAll("iframe").map(
            (iframe) => new Promise((resolve) => iframe.addEventListener("load", resolve))
        )
    );
}
