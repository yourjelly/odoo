/** @odoo-module **/

import { queryOne } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, diff, green, red, text } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {import("../helpers/dom").Target} target
 * @param {string} attribute
 * @param {string} [value]
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function hasAttribute({ isNot }, target, attribute, value, message = "") {
    const element = queryOne(target);
    const expectsValue = ![null, undefined].includes(value);
    const pass = applyModifier(
        expectsValue ? element.getAttribute(attribute) === value : element.hasAttribute(attribute),
        isNot
    );
    if (pass) {
        message ||= `attribute on ${formatHumanReadable(element)}${
            isNot ? " does not have" : " has"
        } the correct value`;
    } else {
        message ||= `expected target to${isNot ? " not" : ""} have the correct value`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), value],
            [red("Received:"), element.getAttribute(attribute)],
            [text("Diff:"), diff(value, element.getAttribute(attribute))],
        ];
    }
    return result;
}

registerAssertMethod(hasAttribute);
