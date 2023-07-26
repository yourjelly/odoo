/** @odoo-module **/

import { config as domConfig, observe, queryAll } from "./dom";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @template T
 */
export function makeDeferred() {
    /** @type {typeof Promise.resolve<T>} */
    let resolve;
    /** @type {typeof Promise.reject<T>} */
    let reject;
    /** @type {Promise<T>} */
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return Object.assign(promise, { resolve, reject });
}

export async function nextTick() {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve));
}

/**
 * @param {import("./dom").Target} predicate
 * @param {{ timeout?: number }} [options]
 */
export function waitFor(target, options) {
    return waitUntil(() => queryAll(target).length, options);
}

/**
 * @param {() => boolean} predicate
 * @param {{ timeout?: number }} [options]
 */
export function waitUntil(predicate, options) {
    if (predicate()) {
        return true;
    }
    let disconnect = () => {};
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
            () => reject(new Error(`'waitUntil' timed out`)),
            options?.timeout || 10_000
        );
        disconnect = observe(domConfig.defaultRoot, () => {
            if (predicate()) {
                resolve(true);
                clearTimeout(timeoutId);
            }
        });
    })
        .then((result) => {
            disconnect();
            return result;
        })
        .catch((reason) => {
            disconnect();
            throw reason;
        });
}
