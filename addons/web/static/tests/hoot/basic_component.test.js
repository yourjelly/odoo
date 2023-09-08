/** @odoo-module **/

import { afterSuite, afterTest, beforeSuite, beforeTest, suite, test } from "@odoo/hoot";

suite("demo", () => {
    const steps = [];
    beforeSuite(() => steps.push("[PARENT] beforeSuite"));
    beforeTest(() => steps.push("[PARENT] beforeTest"));
    afterTest(() => steps.push("[PARENT] afterTest"));
    afterSuite(() => steps.push("[PARENT] afterSuite"));

    window.__DEMO_STEPS__ = steps;

    suite("nested", () => {
        beforeSuite(() => steps.push("[NESTED] beforeSuite"));
        beforeTest(() => steps.push("[NESTED] beforeTest"));
        afterTest(() => steps.push("[NESTED] afterTest"));
        afterSuite(() => steps.push("[NESTED] afterSuite"));

        test("demo nested test", (assert) => {
            steps.push("[NESTED] test");
            assert.ok(true);
        });
    });

    test("demo parent test", (assert) => {
        steps.push("[PARENT] test");
        assert.ok(true);
    });
});
