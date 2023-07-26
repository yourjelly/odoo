/** @odoo-module **/

import { suite, test } from "@odoo/hoot";

suite("Core", () => {
    test("core test", (assert) => {
        assert.ok(true, "oui");
        assert.equal(1, 1);
    });
});
