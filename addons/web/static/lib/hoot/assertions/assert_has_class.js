/** @odoo-module **/

import { queryOne } from "../helpers/dom";
import { formatHumanReadable, isIterable } from "../utils";
import { registerAssertMethod } from "./assert";
import { applyModifier, green, red } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {import("../helpers/dom").Target} target
 * @param {string | string[]} className
 * @param {string} [message=""]
 * @returns {import("./assert").AssertResult}
 */
export function hasClass({ isNot }, target, className, message = "") {
    const classNames = isIterable(className) ? [...className] : [className];
    const element = queryOne(target);

    const pass = applyModifier(
        classNames.every((cls) => element.classList.contains(cls)),
        isNot
    );
    if (pass) {
        message ||= `${formatHumanReadable(element)}${
            isNot ? " does not have any" : " has all"
        } of the given class names`;
    } else {
        message ||= `expected target to${
            isNot ? " not have any" : " have all"
        } of the given class names`;
    }

    /** @type {import("./assert").AssertResult} */
    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), classNames],
            [red("Received:"), [...element.classList]],
        ];
    }
    return result;
}

registerAssertMethod(hasClass);
