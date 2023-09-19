/** @odoo-module **/

import { expect } from "../expect";
import { queryOne } from "../helpers/dom";
import { formatHumanReadable } from "../utils";
import { applyModifier, diff, green, red, text } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<import("../helpers/dom").Target>} context
 * @param {string} attribute
 * @param {string} [value]
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toHaveAttribute({ actual, not }, attribute, value, message = "") {
    const element = queryOne(actual);
    const expectsValue = ![null, undefined].includes(value);
    const pass = applyModifier(
        expectsValue ? element.getAttribute(attribute) === value : element.hasAttribute(attribute),
        not
    );
    if (pass) {
        message ||= `attribute on ${formatHumanReadable(element)}${
            not ? " does not have" : " has"
        } the correct value`;
    } else {
        message ||= `expected target to${not ? " not" : ""} have the correct value`;
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

expect.extend(toHaveAttribute);
