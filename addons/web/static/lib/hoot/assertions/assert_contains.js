/** @odoo-module **/

import { queryAll, queryOne } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, green, red, text } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {import("../helpers/dom").Target} parent
 * @param {import("../helpers/dom").Target} target
 * @param {number | "any"} [amount="any"]
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function contains({ isNot }, parent, target, amount = "any", message = "") {
    const root = queryOne(parent);
    const found = queryAll(target, { root });
    const pass = applyModifier(
        amount === "any" ? Boolean(found.length) : found.length === amount,
        isNot
    );
    if (pass) {
        message ||= `element ${formatHumanReadable(parent)} ${
            isNot ? "does not contain" : "contains"
        } ${amount} elements matching ${formatHumanReadable(target)}`;
    } else {
        message ||= `element does not have the correct amount of matches`;
    }

    /** @type {import("./assert").AssertResult} */
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

registerAssertMethod(contains);
