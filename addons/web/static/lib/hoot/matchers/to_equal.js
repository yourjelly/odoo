/** @odoo-module **/

import { expect } from "../expect";
import { deepEqual, formatHumanReadable } from "../utils";
import { applyModifier, diff, green, red, text } from "./expect_helpers";

/**
 * @template T
 * @param {import("../expect").ExpectContext<T>} context
 * @param {T} expected
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toEqual({ actual, not }, expected, message = "") {
    const pass = applyModifier(deepEqual(actual, expected), not);
    const [hActual, hExpected] = [actual, expected].map(formatHumanReadable);
    if (pass) {
        message ||= `${hExpected} is${not ? " not" : ""} deeply equal to ${hActual}`;
    } else {
        message ||= `expected values${not ? " not" : ""} to be deeply equal`;
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

expect.extend(toEqual);
