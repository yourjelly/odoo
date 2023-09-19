/** @odoo-module **/

import { expect } from "../expect";
import { queryAll, queryOne } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { applyModifier, green, red, text } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<import("../helpers/dom").Target>} context
 * @param {import("../helpers/dom").Target} target
 * @param {number | "any"} [amount="any"]
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toContain({ actual, not }, target, amount = "any", message = "") {
    const root = queryOne(actual);
    const found = queryAll(target, { root });
    const pass = applyModifier(
        amount === "any" ? Boolean(found.length) : found.length === amount,
        not
    );
    if (pass) {
        message ||= `element ${formatHumanReadable(actual)} ${
            not ? "does not contain" : "contains"
        } ${amount} elements matching ${formatHumanReadable(target)}`;
    } else {
        message ||= `element does not have the correct amount of matches`;
    }

    /** @type {import("../expect").ExpectResult} */
    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), amount],
            [red("Received:"), found.length],
            [text("Parent:"), root],
            [text("Matching:"), found],
        ];
    }
    return result;
}

expect.extend(toContain);
