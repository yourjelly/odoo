/** @odoo-module **/

import { formatHumanReadable } from "../utils";
import { registerAssertMethod } from "./assert";

/**
 * @param {import("./assert").Assert} assert
 * @param {string} name
 * @returns {import("./assert").AssertResult}
 */
export function step({ steps, isNot }, name) {
    const errors = [];
    if (isNot) {
        errors.push({ message: "cannot be negated" });
    }
    if (typeof name !== "string") {
        errors.push({ arg: 0, expected: "string", actual: name });
    }
    if (errors.length) {
        return { errors };
    }

    steps.push(name);
    return { pass: true, message: `step: ${formatHumanReadable(name)}` };
}

registerAssertMethod(step);
