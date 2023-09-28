/** @odoo-module */

const { ModuleLoader } = odoo;

function transitiveDeps(mods, mocks) {
    const stack = [...mods];
    const seen = new Set();
    while (stack.length) {
        const current = stack.pop();
        if (!seen.has(current)) {
            seen.add(current);
            if (!(current in mocks)) {
                for (const dep of odoo.loader.factories.get(current).deps) {
                    stack.push(dep);
                }
            }
        }
    }
    return [...seen];
}

export function runModuleSet({ entryPoints = [], mocks = {} }) {
    const modules = transitiveDeps(entryPoints, mocks);
    const loader = new ModuleLoader();
    for (const [mockName, value] of Object.entries(mocks)) {
        loader.define(mockName, [], () => value);
    }
    for (const module of modules) {
        const { deps, fn } = odoo.loader.factories.get(module);
        loader.define(module, deps, fn);
    }
}

import { describe } from "@odoo/hoot";

Promise.resolve().then(() => {
    for (const testSuite of [...odoo.loader.factories.keys()].filter((k) => k.endsWith(".test"))) {
        if (odoo.loader.factories.has(testSuite.replace(/\.test$/, ".hoot"))) {
            continue;
        }
        describe(...testSuite.split("/"), () => {
            runModuleSet({
                entryPoints: [testSuite],
                mocks: {
                    // Keep the same instance of hoot so that the test is added to the correct suite
                    "@odoo/hoot": odoo.loader.modules.get("@odoo/hoot"),
                },
            });
        });
    }
});
