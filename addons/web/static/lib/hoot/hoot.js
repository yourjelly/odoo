/** @odoo-module alias=@odoo/hoot default=false */

import { logger } from "./core/logger";
import { Runner } from "./core/runner";
import { setRunner } from "./hoot_globals";
import { makeRuntimeHook } from "./hoot_utils";
import { setupHootUI } from "./ui/setup_hoot_ui";

/**
 * @typedef {{
 *  runner: Runner;
 *  ui: import("./ui/setup_hoot_ui").UiState
 * }} Environment
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const runner = new Runner();

setRunner(runner);

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {unknown} value
 */
export function registerDebugInfo(value) {
    logger.logDebug("debug context provided:", value);
}

// Main test API
export const describe = runner.describe;
export const expect = runner.expect;
export const test = runner.test;

// Hooks
export const after = makeRuntimeHook("after");
export const afterEach = makeRuntimeHook("afterEach");
export const before = makeRuntimeHook("before");
export const beforeEach = makeRuntimeHook("beforeEach");
export const onError = makeRuntimeHook("onError");

// Other functions
export const dryRun = runner.exportFn(runner.dryRun);
export const getCurrent = runner.exportFn(runner.getCurrent);
export const load = runner.exportFn(runner.load);
export const registerPreset = runner.exportFn(runner.registerPreset);
export const start = runner.exportFn(runner.start);
export const stop = runner.exportFn(runner.stop);

export { makeExpect } from "./core/expect";
export { createJobScopedGetter } from "./hoot_utils";

// Constants
export const globals = {
    fetch,
};
export const __debug__ = runner;

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

setupHootUI();
