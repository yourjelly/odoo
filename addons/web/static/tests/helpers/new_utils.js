/** @odoo-module **/

import { registry } from "@web/core/registry";
import { patch, unpatch } from "@web/core/utils/patch";
import { makeEnv, startServices } from "@web/env";

// -----------------------------------------------------------------------------
// Private stuff
// -----------------------------------------------------------------------------
let currentSuite = null;
const initialRegistryState = {};
const suiteCleanups = {};

QUnit.moduleStart((details) => {
    currentSuite = details.name;
});

QUnit.moduleDone((details) => {
    const suite = details.name;
    if (suite in suiteCleanups) {
        for (let cb of suiteCleanups[suite]) {
            cb();
        }
        delete suiteCleanups[suite];
    }
});

// cloning registry content and resetting them
for (let registryName in registry.subRegistries) {
    const subRegistry = registry.subRegistries[registryName];
    initialRegistryState[registryName] = { ...subRegistry.content };
    subRegistry.content = {};
    subRegistry.elements = null;
    subRegistry.entries = null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export async function makeTestEnv() {
    const env = makeEnv();
    await startServices(env);
    return env;
}

export function setupRegistries(config) {
    suiteCleanups[currentSuite] = suiteCleanups[currentSuite] || [];
    const cleanups = suiteCleanups[currentSuite];
    for (let registryName in config) {
        const currentRegistry = registry.category(registryName);
        const initialState = initialRegistryState[registryName];
        currentRegistry.elements = null;
        currentRegistry.entries = null;
        for (let key of config[registryName]) {
            patch(currentRegistry.content, `__${key}`, { key: initialState[key] });
            currentRegistry.content[key] = initialState[key];
            cleanups.push(() => {
                unpatch(currentRegistry.content, `__${key}`);
                currentRegistry.elements = null;
                currentRegistry.entries = null;
            });
        }
    }
}

/**
 * @returns {HTMLElement}
 */
export function getFixture() {
    if (QUnit.config.debug) {
        return document.body;
    } else {
        return document.querySelector("#qunit-fixture");
    }
}
