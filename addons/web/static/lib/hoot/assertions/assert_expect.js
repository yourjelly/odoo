/** @odoo-module **/

import { Number } from "../globals";
import { registerAssertMethod } from "./assert";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {number} expected
 * @returns {import("./assert").AssertResult}
 */
export function expect(assert, expected) {
    const errors = [];
    if (assert.expects !== null) {
        errors.push({ message: `cannot be called more than once` });
    }
    if (!Number.isInteger(expected)) {
        errors.push({ arg: 0, expected: "integer", actual: expected });
    }
    if (errors.length) {
        return { errors };
    }

    assert.expects = expected + 1;
    return { pass: true };
}

registerAssertMethod(expect);
