/** @odoo-module **/

import { formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, red } from "./assert_helpers";

/**
 * @param {import("./assert").Assert} assert
 * @param {boolean} value
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function ok({ isNot }, value, message = "") {
    const pass = applyModifier(value, isNot);
    const hValue = formatHumanReadable(value);
    if (pass) {
        message ||= `${hValue} is${isNot ? " not" : ""} truthy`;
    } else {
        message ||= `expected value${isNot ? " not" : ""} to be truthy`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [[red("Received:"), value]];
    }
    return result;
}

registerAssertMethod(ok);
