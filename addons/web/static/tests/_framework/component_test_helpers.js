import { after } from "@odoo/hoot";
import { queryFirst } from "@odoo/hoot-dom";
import { App, Component, xml } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { getPopoverForTarget } from "@web/core/popover/popover";
import { getTemplate } from "@web/core/templates";
import { patch } from "@web/core/utils/patch";
import { getMockEnv, makeMockEnv } from "./env_test_helpers";

/**
 * @template {Parameters<typeof import("@odoo/owl").mount>[0]} C
 * @param {C} ComponentClass
 * @param {Parameters<typeof import("@odoo/owl").mount>[1]} target
 * @param {import("@web/env").OdooEnv} env
 * @param {C["prototype"]["props"]} props
 */
const mountOnTarget = (ComponentClass, target, env, props) => {
    const app = new App(ComponentClass, {
        env,
        getTemplate,
        name: `TEST: ${ComponentClass.name}`,
        props,
        test: true,
        translateFn: _t,
        warnIfNoStaticProps: true,
    });

    after(() => destroy(app));

    return app.mount(target);
};

/**
 * @typedef {import("@odoo/owl").Component} Component
 */

patch(MainComponentsContainer.prototype, {
    setup() {
        super.setup();

        hasMainComponent = true;
        after(() => (hasMainComponent = false));
    },
});

const destroyed = new WeakSet();
let hasMainComponent = false;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {App | Component} target
 */
export function destroy(target) {
    const app = target instanceof App ? target : target.__owl__.app;
    if (destroyed.has(app)) {
        return;
    }
    destroyed.add(app);
    app.destroy();
}

/**
 * @param {App | Component} parent
 * @param {(component: Component) => boolean} predicate
 * @returns {Component | null}
 */
export function findComponent(parent, predicate) {
    const rootNode = parent instanceof App ? parent.root : parent.__owl__;
    const queue = [rootNode, ...Object.values(rootNode.children)];
    while (queue.length) {
        const { children, component } = queue.pop();
        if (predicate(component)) {
            return component;
        }
        queue.unshift(...Object.values(children));
    }
    return null;
}

/**
 * Returns the dropdown menu for a specific toggler.
 *
 * @param {import("@odoo/hoot-dom").Target} togglerSelector
 * @returns {HTMLElement | undefined}
 */
export function getDropdownMenu(togglerSelector) {
    let el = queryFirst(togglerSelector);
    if (el && !el.classList.contains("o-dropdown")) {
        el = el.querySelector(".o-dropdown");
    }
    if (!el) {
        throw new Error(`getDropdownMenu: Could not find element "${togglerSelector}".`);
    }
    return getPopoverForTarget(el);
}

/**
 * Mounts a given component to the test fixture.
 *
 * By default, a `MainComponentsContainer` component is also mounted to the
 * fixture if none is found in the component tree (this can be overridden by the
 * `noMainContainer` option).
 *
 * @template {import("@odoo/owl").ComponentConstructor<P, E>} C
 * @template [P={}]
 * @template [E=import("@web/env").OdooEnv]
 * @param {C | string} ComponentClass
 * @param {{
 *  env?: E;
 *  getTemplate?: Document;
 *  noMainContainer?: boolean;
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

    const env = options?.env || getMockEnv() || (await makeMockEnv());
    const target = options?.target || document.body;
    target.classList?.add("o_web_client");

    /** @type {InstanceType<C>} */
    const component = await mountOnTarget(ComponentClass, target, env, options?.props);
    if (!options?.noMainContainer && !hasMainComponent) {
        await mountOnTarget(MainComponentsContainer, target, env, {});
    }

    return component;
}
