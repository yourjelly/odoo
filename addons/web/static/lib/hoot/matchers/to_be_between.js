/** @odoo-module **/

import { expect } from "../expect";
import { formatHumanReadable, isIterable } from "../utils";
import { applyModifier, green, red } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<number>} context
 * @param {number | [number, number]} min
 * @param {number | string} [max]
 * @param {string} [message]
 * @returns {import("../expect").ExpectResult}
 */
export function toBeBetween({ actual, not }, min, max, message = "") {
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
    const [hActual, hMin, hMax] = [actual, min, max].map(formatHumanReadable);
    if (max < min) {
        errors.push({
            message: `first argument must be smaller than the second, got ${hMin} and ${hMax}`,
        });
    }
    if (errors.length) {
        return { errors };
    }

    const pass = applyModifier(min <= actual && actual <= max, not);
    if (pass) {
        message ||= `${hActual} is${not ? " not" : ""} between ${hMin} and ${hMax}`;
    } else {
        message ||= `expected value to${not ? " not" : ""} be within given range`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), `${min} - ${max}`],
            [red("Received:"), actual],
        ];
    }
    return result;
}

expect.extend(toBeBetween);
