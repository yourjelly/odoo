/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";
import { SpreadsheetServerDataService } from "@spreadsheet/data/data_service";

QUnit.module("spreadsheet > Spreadsheet Server Data > display names", {}, () => {
    QUnit.test("Name_get are collected and executed once by clock", async function (assert) {
        const orm = {
            call: async (model, method, args) => {
                const ids = args[0];
                assert.step(`${method}-${model}-[${ids.join(",")}]`);
                return ids.map((id) => [id, id.toString()]);
            },
        };

        const serverData = new SpreadsheetServerDataService(orm);

        serverData.addEventListener("data-fetched", () => {
            assert.step("data-fetched");
        });

        assert.throws(() => serverData.displayNames.get("A", 1), /Data is loading/);
        assert.throws(() => serverData.displayNames.get("A", 1), /Data is loading/);
        assert.throws(() => serverData.displayNames.get("A", 2), /Data is loading/);
        assert.throws(() => serverData.displayNames.get("B", 1), /Data is loading/);
        assert.verifySteps([]);

        await nextTick();
        assert.verifySteps(["name_get-A-[1,2]", "name_get-B-[1]", "data-fetched", "data-fetched"]);

        assert.strictEqual(serverData.displayNames.get("A", 1), "1");
        assert.strictEqual(serverData.displayNames.get("A", 2), "2");
        assert.strictEqual(serverData.displayNames.get("B", 1), "1");
    });

    QUnit.test("Name_get to fetch are cleared after being fetched", async function (assert) {
        const orm = {
            call: async (model, method, args) => {
                const ids = args[0];
                assert.step(`${method}-${model}-[${ids.join(",")}]`);
                return ids.map((id) => [id, id.toString()]);
            },
        };

        const serverData = new SpreadsheetServerDataService(orm);

        assert.throws(() => serverData.displayNames.get("A", 1));
        assert.verifySteps([]);

        await nextTick();
        assert.verifySteps(["name_get-A-[1]"]);

        assert.throws(() => serverData.displayNames.get("A", 2));
        await nextTick();
        assert.verifySteps(["name_get-A-[2]"]);
    });

    QUnit.test(
        "Assigning a result after triggering the request should not crash",
        async function (assert) {
            const orm = {
                call: async (model, method, args) => {
                    const ids = args[0];
                    assert.step(`${method}-${model}-[${ids.join(",")}]`);
                    return ids.map((id) => [id, id.toString()]);
                },
            };

            const serverData = new SpreadsheetServerDataService(orm);

            assert.throws(() => serverData.displayNames.get("A", 1));
            assert.verifySteps([]);
            serverData.displayNames.set("A", 1, "test");
            assert.strictEqual(serverData.displayNames.get("A", 1), "test");

            await nextTick();
            assert.verifySteps(["name_get-A-[1]"]);
            assert.strictEqual(serverData.displayNames.get("A", 1), "1");
        }
    );

    QUnit.test(
        "Name_get will retry with one id by request in case of failure",
        async function (assert) {
            const orm = {
                call: async (model, method, args) => {
                    const ids = args[0];
                    assert.step(`${method}-${model}-[${ids.join(",")}]`);
                    if (model === "B" && ids.includes(1)) {
                        throw new Error("Missing");
                    }
                    return ids.map((id) => [id, id.toString()]);
                },
            };

            const serverData = new SpreadsheetServerDataService(orm);

            assert.throws(() => serverData.displayNames.get("A", 1), /Data is loading/);
            assert.throws(() => serverData.displayNames.get("B", 1), /Data is loading/);
            assert.throws(() => serverData.displayNames.get("B", 2), /Data is loading/);
            assert.verifySteps([]);

            await nextTick();
            assert.verifySteps([
                "name_get-A-[1]",
                "name_get-B-[1,2]",
                "name_get-B-[1]",
                "name_get-B-[2]",
            ]);

            assert.strictEqual(serverData.displayNames.get("A", 1), "1");
            assert.throws(
                () => serverData.displayNames.get("B", 1),
                /Unable to fetch the label of 1 of model B/
            );
            assert.strictEqual(serverData.displayNames.get("B", 2), "2");
        }
    );
});
