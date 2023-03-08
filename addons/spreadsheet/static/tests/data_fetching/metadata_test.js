/** @odoo-module */

import { SpreadsheetServerDataService } from "@spreadsheet/data/data_service";

QUnit.module("spreadsheet > Spreadsheet Server Data > metadata", {}, () => {
    QUnit.test("Fields_get are only loaded once", async function (assert) {
        assert.expect(6);

        const orm = {
            call: async (model, method) => {
                assert.step(`${method}-${model}`);
                return model;
            },
        };

        const serverData = new SpreadsheetServerDataService(orm);

        const first = await serverData.metaData.fieldsGet("A");
        const second = await serverData.metaData.fieldsGet("A");
        const third = await serverData.metaData.fieldsGet("B");

        assert.strictEqual(first, "A");
        assert.strictEqual(second, "A");
        assert.strictEqual(third, "B");

        assert.verifySteps(["fields_get-A", "fields_get-B"]);
    });

    QUnit.test("display_name_for on ir.model are only loaded once", async function (assert) {
        assert.expect(6);

        const orm = {
            call: async (model, method, args) => {
                if (method === "display_name_for" && model === "ir.model") {
                    const [modelName] = args[0];
                    assert.step(`${modelName}`);
                    return [{ display_name: modelName, model: modelName }];
                }
            },
        };

        const serverData = new SpreadsheetServerDataService(orm);

        const first = await serverData.metaData.modelDisplayName("A");
        const second = await serverData.metaData.modelDisplayName("A");
        const third = await serverData.metaData.modelDisplayName("B");

        assert.strictEqual(first, "A");
        assert.strictEqual(second, "A");
        assert.strictEqual(third, "B");

        assert.verifySteps(["A", "B"]);
    });
});
