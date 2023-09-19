/** @odoo-module **/

import { expect } from "../expect";
import { formatHumanReadable } from "../utils";
import { applyModifier, red } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<true>} context
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toBeTruthy({ actual, not }, message = "") {
    const pass = applyModifier(actual, not);
    const hActual = formatHumanReadable(actual);
    if (pass) {
        message ||= `${hActual} is${not ? " not" : ""} truthy`;
    } else {
        message ||= `expected value${not ? " not" : ""} to be truthy`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [[red("Received:"), actual]];
    }
    return result;
}

expect.extend(toBeTruthy);
