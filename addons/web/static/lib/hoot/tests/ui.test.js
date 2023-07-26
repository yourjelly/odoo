/** @odoo-module **/

import { makeTestRunner } from "../core/runner";
import { waitFor } from "../helpers/concurency";
import { config, getText } from "../helpers/dom";
import { beforeEach, suite, test } from "../setup";
import { mountRunner } from "./local_helpers";

suite.ui("HOOT", "UI", () => {
    beforeEach(() => {
        for (const el of document.head.querySelectorAll("link,script,style")) {
            config.defaultRoot.ownerDocument.head.appendChild(el.cloneNode(true));
        }
    });

    test("can run in headless", async (assert) => {
        const runner = makeTestRunner({ autostart: false, headless: true });

        await mountRunner(runner);
        await waitFor(".hoot-fixture");

        assert.not.contains("body", ".hoot-runner");
    });

    test("can start automatically", async (assert) => {
        const runner = makeTestRunner({
            autostart: true,
            showpassed: true,
            meta: { renderInterval: 0 },
        });

        runner.test("a test", ({ ok }) => {
            assert.step("a test");

            ok(true);
        });

        await mountRunner(runner);
        await waitFor(".hoot-result.hoot-pass");

        assert.verifySteps(["a test"]);
    });

    test("can prevent from starting automatically", async (assert) => {
        const runner = makeTestRunner({ autostart: false });

        runner.test("a test", ({ ok }) => {
            assert.step("a test");

            ok(true);
        });

        await mountRunner(runner);

        assert.deepEqual(getText(".hoot-status"), ["Ready"]);
        assert.verifySteps([]);
    });

    test("should display tags", async (assert) => {
        const runner = makeTestRunner({ showpassed: true, renderInterval: 0 });

        let testFn = runner.test;
        for (let i = 1; i <= 10; i++) {
            testFn = testFn[`Tag ${i}`];
        }

        testFn("tagged test", ({ ok }) => {
            assert.step("tagged test");

            ok(true);
        });

        await mountRunner(runner);
        await waitFor(".hoot-result.hoot-pass");

        assert.contains(".hoot-runner", ".hoot-tag", 10);
        assert.verifySteps(["tagged test"]);
    });
});
