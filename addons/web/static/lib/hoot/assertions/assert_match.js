/** @odoo-module **/

import { match as _match, formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, green, red } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {unknown} value
 * @param {import("../utils").Matcher} matcher
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function match({ isNot }, value, matcher, message = "") {
    const pass = applyModifier(_match(value, matcher), isNot);
    const [hValue, hMatcher] = [value, matcher].map(formatHumanReadable);
    if (pass) {
        message ||= `${hValue} ${isNot ? "does not match" : "matches"} ${hMatcher}`;
    } else {
        message ||= `expected value${isNot ? " not" : ""} to match the given matcher`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Matcher:"), value],
            [red("Received:"), matcher],
        ];
    }
    return result;
}

registerAssertMethod(match);
