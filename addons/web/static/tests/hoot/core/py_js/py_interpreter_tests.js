/** @odoo-module */

import { describe, test, expect } from "@odoo/hoot";
import { evaluateExpr } from "@web/core/py_js/py";

describe("core", "py_js", "interpreter", () => {
    describe("basic values", () => {
        test("evaluate simple values", () => {
            expect(evaluateExpr("12")).toBe(12);
            expect(evaluateExpr('"foo"')).toBe("foo");
        });
    });
});
