/** @odoo-module */

import { clearTimeout, Error, Promise, requestAnimationFrame, setTimeout } from "../globals";
import { config as domConfig, observe, queryAll } from "./dom";

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @template [T=unknown]
 */
class Deferred extends Promise {
    /** @type {typeof Promise.resolve<T>} */
    #resolve;
    /** @type {typeof Promise.reject<T>} */
    #reject;

    /**
     * @param {(resolve: (value: T) => void, reject: (reason?: any) => void) => void} [executor]
     */
    constructor(executor) {
        let _resolve, _reject;

        super((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
            return executor?.(resolve, reject);
        });

        this.#resolve = _resolve;
        this.#reject = _reject;
    }

    /**
     * @param {any} [reason]
     */
    reject(reason) {
        return this.#reject(reason);
    }

    /**
     * @param {T} [value]
     */
    resolve(value) {
        return this.#resolve(value);
    }
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function makeDeferred() {
    return new Deferred();
}

export async function nextTick() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
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
