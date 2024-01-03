/** @odoo-module */

import { App, Component } from "@odoo/owl";
import { defineRootNode, getActiveElement } from "@web/../lib/hoot-dom/helpers/dom";
import { resetEventActions } from "@web/../lib/hoot-dom/helpers/events";

/**
 * @typedef {{
 *  component: typeof Component;
 *  props: unknown;
 * }} TestRootProps
 */

//-----------------------------------------------------------------------------
// Globals
//-----------------------------------------------------------------------------

const { document, getSelection } = globalThis;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {import("./runner").TestRunner} runner
 */
export function makeFixtureManager(runner) {
    const cleanupFixture = () => {
        if (fixture) {
            fixture.remove();
            fixture = null;
        }
    };

    const getFixture = () => {
        if (!fixture) {
            resetEventActions();

            fixture = document.createElement("div");
            fixture.className = "hoot-fixture";
            if (runner.debug) {
                fixture.classList.add("hoot-debug");
            }

            // Reset focus & selection
            getActiveElement().blur();
            getSelection().removeAllRanges();

            document.body.appendChild(fixture);
        }
        return fixture;
    };

    /**
     * @param {Parameters<typeof import("@odoo/owl").mount>[0]} ComponentClass
     * @param {Parameters<typeof import("@odoo/owl").mount>[2]} config
     */
    const mountOnFixture = (ComponentClass, config) => {
        const app = new App(ComponentClass, {
            name: `TEST: ${ComponentClass.name}`,
            test: true,
            warnIfNoStaticProps: true,
            ...config,
        });

        runner.after(() => app.destroy());

        return app.mount(getFixture());
    };

    /** @type {HTMLElement | null} */
    let fixture = null;

    runner.beforeAll(() => {
        defineRootNode(getFixture);
    });
    runner.afterAll(() => {
        defineRootNode(null);
    });

    return {
        cleanup: cleanupFixture,
        get: getFixture,
        mount: mountOnFixture,
    };
}
