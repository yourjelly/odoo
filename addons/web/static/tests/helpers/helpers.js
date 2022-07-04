/** @odoo-module **/

import { registry } from "@web/core/registry";
import { patch, unpatch } from "@web/core/utils/patch";
import { makeEnv, startServices } from "@web/env";
import { browser, makeRAMLocalStorage } from "@web/core/browser/browser";

// TODO: remove this
export { magicSetup } from "../setup";

/**
 * This file is intended to be the main entry point for all test helpers, and
 * to be the only helper file necessary to write tests. It will export helpers
 * to perform the following kind of tasks:
 * - setup registries and patches for a test suite
 * - provide mock implementations of some basic services
 * - random test helpers: getFixture, nextTick, nextMicrotick,
 * - dom interaction helpers: click, keydown, writeInInput, ...
 * - various presets to help quickly setting up: WEB_MISC_MENU_ITEMS, WEB_VIEWS, ...
 * - helpers to generate mock data
 *
 * Here is a short list of what it could look like:
 *
 * utils
 *      getFixture,
 *      nextTick,
 *      nextMicroTick
 *      mountWithCleanup
 *      makeTestEnv
 *      makeDeferred
 *
 * suiteSetup
 *      setRegistries
 *      setPatches
 *      setTiming <-- timeout, cleartimeout stuff
 *      setDate   <-- current date
 *      setTimeZone (or merge with setDate into setTime?)
 *
 * dom
 *      click
 *      triggerKeyPress
 *      triggerKeyDown
 *      dragAndDrop
 *      ...
 *
 * components
 *      viewClickDiscard
 *      viewClickEdit
 *      searchApplyFilter
 *      searchEditInput
 *      searchGetPagerValue
 *      webClientDoAction
 *      listAddRow
 *      searchToggleMenuItem
 *
 * builders
 *      makeWebClient
 *      makeView
 *
 * mocks
 *      makeMockNotificationService
 *      makeFakeUserService
 *      ...
 *
 * presets
 *      WEB_MISC_MENU_ITEMS
 *      WEB_VIEWS,
 *      ...
 * data
 *      makeServerModel
 *
 * Note: there should not be patch/patchWithCleanup
 *
 */

// -----------------------------------------------------------------------------
// Private stuff
// -----------------------------------------------------------------------------
let currentSuite = null;
let currentTest = null;
let initialRegistryState = {};
let testCleanups = [];
let suiteCleanups = {};

QUnit.testDone(() => {
    for (let cb of testCleanups) {
        cb();
    }
    testCleanups = [];
});

QUnit.testStart((details) => {
    currentTest = details.name;
});

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
}

// intercepting all addEventListener on browser to remove them after test
const addEventListener = browser.addEventListener;
const removeEventListener = browser.removeEventListener;

browser.addEventListener = (type, listener, options) => {
    testCleanups.push(() => {
        removeEventListener(type, listener, options);
    });
    addEventListener(type, listener, options);
};

// clearing all registries before each test
QUnit.testStart(() => {
    for (let registryName in registry.subRegistries) {
        const subRegistry = registry.subRegistries[registryName];
        subRegistry.content = {};
        subRegistry.elements = null;
        subRegistry.entries = null;
    }
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export async function makeTestEnv() {
    const env = makeEnv();
    await startServices(env);
    return env;
}

// todo: need a way to easily provide mock base services
// for example:
// setupRegistries({
//   services: ["ui", "dialog", "localization.mock"],
//   otherRegistry: "*"
// });
export function setupRegistries(config) {
    suiteCleanups[currentSuite] = suiteCleanups[currentSuite] || [];
    const cleanups = suiteCleanups[currentSuite];
    for (let registryName in config) {
        const currentRegistry = registry.category(registryName);
        const initialState = initialRegistryState[registryName];
        currentRegistry.elements = null;
        currentRegistry.entries = null;
        let targets = config[registryName];
        if (targets === "*") {
            targets = Object.keys(initialState);
        }
        for (let key of targets) {
            patch(currentRegistry.content, `__${key}`, { [key]: initialState[key] });
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
