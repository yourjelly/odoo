/** @odoo-module */

import { makeDeferred, nextTick, waitFor, waitUntil } from "../../helpers/concurrency";
import { describe, expect, test } from "../../hoot";

describe("@odoo/hoot/helpers", "Concurrency", () => {
    test("makeDeferred", async () => {
        const def = makeDeferred();

        def.then(() => expect.step("resolved"));

        expect.step("before");

        def.resolve(14);

        expect.step("after");

        await expect(def).resolves.toBe(14);

        expect(["before", "after", "resolved"]).toVerifySteps();
    });

    test("nextTick", async () => {
        let count = 0;

        const nextTickPromise = nextTick().then(() => ++count);

        expect(count).toBe(0);

        await expect(nextTickPromise).resolves.toBe(1);

        expect(count).toBe(1);
    });

    test.ui.skip("waitFor", async () => {
        expect(waitFor()).toBeTruthy();
    });

    test.ui.skip("waitUntil", async () => {
        expect(waitUntil()).toBeTruthy();
    });
});
