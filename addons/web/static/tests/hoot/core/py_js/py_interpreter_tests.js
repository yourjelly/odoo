/** @odoo-module **/

import { beforeSuite, suite, test, expect } from "@odoo/hoot";
import { fromModules } from "../../helpers";

const importCode = fromModules(["@web/core/py_js/py"]);

suite("core", "py_js", "interpreter", () => {
    let py;
    beforeSuite(async () => {
        py = importCode("@web/core/py_js/py");
    });
    suite("basic values", () => {
        test("evaluate simple values", (assert) => {
            expect(py.evaluateExpr("12")).toBe(12);
            expect(py.evaluateExpr('"foo"')).toBe("foo");
        });
    });
});
