/** @odoo-module **/

import { formatHumanReadable, isIterable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, green, red } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {number} value
 * @param {number | [number, number]} min
 * @param {number | string} [max]
 * @param {string} [message]
 * @returns {import("./assert").AssertResult}
 */
export function between({ isNot }, value, min, max, message = "") {
    if (isIterable(min)) {
        message = max;
        [min, max] = min;
    }

    const errors = [];
    if (isNaN(min)) {
        errors.push({ arg: 0, expected: "number or list of numbers", actual: min });
    }
    if (isNaN(max)) {
        errors.push({ arg: 1, expected: "number", actual: max });
    }
    const [hValue, hMin, hMax] = [value, min, max].map(formatHumanReadable);
    if (max < min) {
        errors.push({
            message: `first argument must be smaller than the second, got ${hMin} and ${hMax}`,
        });
    }
    if (errors.length) {
        return { errors };
    }

    const pass = applyModifier(min <= value && value <= max, isNot);
    if (pass) {
        message ||= `${hValue} is${isNot ? " not" : ""} between ${hMin} and ${hMax}`;
    } else {
        message ||= `expected value to${isNot ? " not" : ""} be within given range`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), `${min} - ${max}`],
            [red("Received:"), value],
        ];
    }
    return result;
}

registerAssertMethod(between);
