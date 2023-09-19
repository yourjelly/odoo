/** @odoo-module **/

import { expect } from "../expect";
import { formatHumanReadable, match } from "../utils";
import { applyModifier, green, red } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<unknown>} context
 * @param {import("../utils").Matcher} matcher
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toMatch({ actual, not }, matcher, message = "") {
    const pass = applyModifier(match(actual, matcher), not);
    const [hActual, hMatcher] = [actual, matcher].map(formatHumanReadable);
    if (pass) {
        message ||= `${hActual} ${not ? "does not match" : "matches"} ${hMatcher}`;
    } else {
        message ||= `expected value${not ? " not" : ""} to match the given matcher`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Matcher:"), matcher],
            [red("Received:"), actual],
        ];
    }
    return result;
}

expect.extend(toMatch);
