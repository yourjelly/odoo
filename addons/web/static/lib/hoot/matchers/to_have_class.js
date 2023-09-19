/** @odoo-module **/

import { expect } from "../expect";
import { queryOne } from "../helpers/dom";
import { formatHumanReadable, isIterable } from "../utils";
import { applyModifier, green, red } from "./expect_helpers";

/**
 * @param {import("../expect").ExpectContext<import("../helpers/dom").Target>} context
 * @param {string | string[]} className
 * @param {string} [message=""]
 * @returns {import("../expect").ExpectResult}
 */
export function toHaveClass({ actual, not }, className, message = "") {
    const element = queryOne(actual);
    const classNames = isIterable(className) ? [...className] : [className];

    const pass = applyModifier(
        classNames.every((cls) => element.classList.contains(cls)),
        not
    );
    if (pass) {
        message ||= `${formatHumanReadable(element)}${
            not ? " does not have any" : " has all"
        } of the given class names`;
    } else {
        message ||= `expected target to${
            not ? " not have any" : " have all"
        } of the given class names`;
    }

    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), classNames],
            [red("Received:"), [...element.classList]],
        ];
    }
    return result;
}

expect.extend(toHaveClass);
