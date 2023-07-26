/** @odoo-module **/

import { isVisible as _isVisible } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, red } from "./assert_helpers";

/**
 * @param {import("./assert").Assert} assert
 * @param {import("../helpers/dom").Target} target
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function isVisible({ isNot }, target, message = "") {
    const pass = applyModifier(_isVisible(target), isNot);
    if (pass) {
        message ||= `${formatHumanReadable(target)} is${isNot ? " not" : ""} visible`;
    } else {
        message ||= `expected target to be${isNot ? "invisible" : "visible"}`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [[red("Received:"), target]];
    }
    return result;
}

registerAssertMethod(isVisible);
