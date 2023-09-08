/** @odoo-module **/

import { afterAll, suite, test } from "@odoo/hoot";
import { whenReady } from "@odoo/owl";

suite("demo", () => {
    for (let s = 0; s < 100; s++) {
        suite(`suite ${s}`, () => {
            for (let t = 0; t < 100; t++) {
                test(`test ${t} from suite ${s}`, (assert) => {
                    assert.ok(true);
                });
            }
        });
    }
});

afterAll(() => {
    const runner = document.querySelector(".hoot");
    if (runner) {
        runner.style.display = "none";
    }
});

whenReady(() => {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "https://code.jquery.com/qunit/qunit-2.19.4.css";

    const qunit = document.createElement("div");
    qunit.id = "qunit";

    const fixture = document.createElement("div");
    fixture.id = "qunit-fixture";

    const script = document.createElement("script");
    script.src = "https://code.jquery.com/qunit/qunit-2.19.4.js";
    script.onload = () => {
        console.log("Starting QUnit...");

        const { module, test } = QUnit;
        module("demo", () => {
            for (let m = 0; m < 100; m++) {
                module(`module ${m}`, () => {
                    for (let t = 0; t < 100; t++) {
                        test(`test ${t} from module ${m}`, (assert) => {
                            assert.ok(true);
                        });
                    }
                });
            }
        });
    };

    document.head.append(style);
    document.body.append(qunit, fixture, script);
});
