/** @odoo-module **/

import { expect } from "../expect";
import { match } from "../utils";
import { green, red } from "./expect_helpers";

/**
 * @template T
 * @param {import("../expect").ExpectContext<(() => T) | T>} context
 * @param {import("../utils").Matcher} [matcher=Error]
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toThrow({ actual, not }, matcher = Error, message = "") {
    const isFunction = typeof actual === "function";

    let name;
    if (isFunction) {
        name = actual.name ? `function ${actual.name}` : "anonymous function";
    } else {
        name = String(actual);
    }

    if (isFunction) {
        try {
            actual = actual();
        } catch (error) {
            actual = error;
        }
    }

    const pass = match(actual, matcher);
    message ||= pass
        ? `${name} did${not ? " not" : ""} throw`
        : `${name} rejected an invalid error`;
    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Matcher:"), matcher],
            [red("Received:"), actual],
        ];
    }
    return result;
}

expect.extend(toThrow);
