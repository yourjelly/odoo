/** @odoo-module */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const originalValues = new WeakMap();

/** @type {import("./core/runner").Runner} */
let runner;
/** @type {Window} */
let targetWindow = window;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @template T
 * @param {T} target
 * @param {keyof T} property
 */
export function getOriginalValue(target, property) {
    return originalValues.get(target)?.[property];
}

export function getRunner() {
    return runner;
}

export function getTargetWindow() {
    return targetWindow;
}

/**
 * @template T
 * @param {T} target
 * @param {keyof T} property
 */
export function protectOriginalValue(target, property) {
    if (!originalValues.has(target)) {
        originalValues.set(target, {});
    }
    originalValues.get(target)[property] = target[property];
}

/**
 * @param {typeof runner} mainRunner
 */
export function setRunner(mainRunner) {
    runner = mainRunner;
}

/**
 * @param {typeof targetWindow} window
 */
export function setTargetWindow(window) {
    targetWindow = window;
}
