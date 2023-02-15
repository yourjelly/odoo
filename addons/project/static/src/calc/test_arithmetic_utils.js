/** @odoo-module **/

import { addition ,substation , division, multiplication} from "./arithmetic_utils.js";

QUnit.module("project", {}, function () {
    QUnit.only("test arithmetic utils function", function (assert) {
        assert.expect(3);
        // addition two value
        const sum = addition(1,2);
        assert.strictEqual(sum, 3);
        // substation two value
        const sub = substation(2,1);
        assert.strictEqual(sub, 1);
        // multiplication two value
        const mult = multiplication(2,2);
        assert.strictEqual(mult, 4);
    });
});
