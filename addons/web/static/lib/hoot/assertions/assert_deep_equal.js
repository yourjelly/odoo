/** @odoo-module **/

import { deepEqual as _deepEqual, formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, diff, green, red, text } from "./assert_helpers";

/**
 * @template {unknown} T
 * @param {import("./assert").Assert} assert
 * @param {T} actual
 * @param {T} expected
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function deepEqual({ isNot }, actual, expected, message = "") {
    const pass = applyModifier(_deepEqual(actual, expected), isNot);
    const [hExpected, hActual] = [expected, actual].map(formatHumanReadable);
    if (pass) {
        message ||= `${hExpected} is${isNot ? " not" : ""} deeply equal to ${hActual}`;
    } else {
        message ||= `expected values${isNot ? " not" : ""} to be deeply equal`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), expected],
            [red("Received:"), actual],
            [text("Diff:"), diff(expected, actual)],
        ];
    }
    return result;
}

registerAssertMethod(deepEqual);
