/** @odoo-module */

import { Promise } from "./globals";

/**
 * @template O
 * @template {keyof O} F
 * @param {O} owner
 * @param {F} fnName
 * @param {O[F]} callback
 */
export function intercept(owner, fnName, callback) {
    const originalFn = owner[fnName];
    const mockName = `${fnName} (mocked)`;

    owner[fnName] = {
        [mockName](...args) {
            const result = callback.call(this, ...args);
            if (result instanceof Promise) {
                return result.then(() => originalFn(...args));
            } else {
                return originalFn(...args);
            }
        },
    }[mockName];

    return function restore() {
        owner[fnName] = originalFn;
    };
}
