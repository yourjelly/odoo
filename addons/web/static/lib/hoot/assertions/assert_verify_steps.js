/** @odoo-module **/

import { registerAssertMethod } from "./assert";
import { diff, green, red, text } from "./assert_helpers";

/**
 * @param {import("./assert").AssertInfo} assert
 * @param {string[]} expectedSteps
 * @returns {import("./assert").AssertResult}
 */
export function verifySteps(assert, expectedSteps) {
    const { isNot } = assert;
    if (isNot) {
        return { errors: [{ message: "cannot be negated" }] };
    }

    const actual = assert.steps || [];
    let pass = expectedSteps.length === actual.length;
    if (pass) {
        for (let i = 0; i < expectedSteps.length; i++) {
            if (expectedSteps[i] !== actual[i]) {
                pass = false;
                break;
            }
        }
    }

    assert.steps = [];

    const message = `all ${actual.length} steps are${pass ? "" : " not"} correct`;
    const result = { message, pass };
    if (!pass) {
        result.info = [
            [green("Expected:"), expectedSteps],
            [red("Received:"), actual],
            [text("Diff:"), diff(expectedSteps, actual)],
        ];
    }
    return result;
}

registerAssertMethod(verifySteps);
