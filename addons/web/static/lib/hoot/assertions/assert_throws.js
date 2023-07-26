/** @odoo-module **/

import { match } from "../utils";
import { registerAssertMethod } from "./assert";

/**
 * @param {import("./assert").Assert} assert
 * @param {() => any} fn
 * @param {import("../utils").Matcher} [matcher=Error]
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function throws({ isNot }, fn, matcher = Error, message = "") {
    if (!(typeof fn === "function")) {
        return { errors: [{ arg: 0, expected: "function", actual: fn }] };
    }

    const name = fn.name ? `function ${fn.name}` : "anonymous function";
    try {
        const result = fn();
        if (result instanceof Promise) {
            throw new Error(`callback should not return a promise. Use 'assert.rejects' instead.`);
        }
    } catch (error) {
        if (isNot) {
            message ||= `expected ${name} not to throw`;
            return { pass: false, message };
        }
        const pass = match(error, matcher);
        message ||= pass ? `${name} did throw` : `${name} rejected an invalid error`;
        return { pass, message };
    }

    const pass = isNot;
    message ||= pass ? `${name} did not throw` : `expected ${name} to throw`;
    return { pass, message };
}

registerAssertMethod(throws);
