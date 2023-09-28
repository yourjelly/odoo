/** @odoo-module */

import { describe } from "@odoo/hoot";
import { runModuleSet } from "@web/../tests/_module_set_poc/module_set.hoot";

/* global require */
const suiteName = require.moduleName.slice(0, -5);
Promise.resolve().then(() => {
    describe(...suiteName.split("/"), () => {
        runModuleSet({
            entryPoints: [suiteName + ".test"],
            mocks: {
                // Keep the same instance of hoot so that the test is added to the correct suite
                "@odoo/hoot": odoo.loader.modules.get("@odoo/hoot"),
            },
        });
    });
});
