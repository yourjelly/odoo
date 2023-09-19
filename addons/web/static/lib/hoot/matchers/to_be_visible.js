/** @odoo-module **/

import { expect } from "../expect";
import { isVisible } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { applyModifier, red } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<import("../helpers/dom").Target>} context
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toBeVisible({ actual, not }, message = "") {
    const pass = applyModifier(isVisible(actual), not);
    if (pass) {
        message ||= `${formatHumanReadable(actual)} is${not ? " not" : ""} visible`;
    } else {
        message ||= `expected target to be${not ? "invisible" : "visible"}`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [[red("Received:"), target]];
    }
    return result;
}

expect.extend(toBeVisible);
