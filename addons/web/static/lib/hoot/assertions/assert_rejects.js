/** @odoo-module **/

import { match } from "../utils";
import { registerAssertMethod } from "./assert";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {() => any} fn
 * @param {import("../utils").Matcher} [matcher=Error]
 * @param {string} [message=""]
 * @returns {Promise<import("./assert").AssertResult>}
 */
export async function rejects({ isNot }, fn, matcher = Error, message = "") {
    if (!(typeof fn === "function")) {
        return { errors: [{ arg: 0, expected: "function", actual: fn }] };
    }

    try {
        await fn();
    } catch (error) {
        if (isNot) {
            message ||= `expected function not to reject`;
            return { message, pass: false };
        }
        const pass = match(error, matcher);
        message ||= pass ? `function did reject` : `function rejected an invalid error`;
        return { message, pass };
    }

    const pass = isNot;
    message ||= pass ? `function did not reject` : `expected function to reject`;

    return { message, pass };
}

registerAssertMethod(rejects);
