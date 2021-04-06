/** @odoo-module **/

import { browser } from "@web/core/browser";
import { debugRegistry } from "@web/debug/debug_registry";

export function runPosJSTestsItem(env) {
    const runTestsURL = browser.location.origin + "/pos/ui/tests?mod=*";
    return {
        type: "item",
        description: env._t("Run Point of Sale JS Tests"),
        href: runTestsURL,
        callback: () => {
            browser.open(runTestsURL);
        },
        sequence: 31,
    };
}

debugRegistry.add("runPosJSTestsItem", runPosJSTestsItem);
