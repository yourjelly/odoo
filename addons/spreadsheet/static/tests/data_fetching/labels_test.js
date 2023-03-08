/** @odoo-module */

import { SpreadsheetServerDataService } from "@spreadsheet/data/data_service";

QUnit.module("spreadsheet > Spreadsheet Server Data > labels", {}, () => {
    QUnit.test("Register label correctly memorize labels", function (assert) {
        assert.expect(2);

        const serverData = new SpreadsheetServerDataService({});

        assert.strictEqual(serverData.labels.get("model", "field", "value"), undefined);
        const label = "label";
        serverData.labels.set("model", "field", "value", label);
        assert.strictEqual(serverData.labels.get("model", "field", "value"), label);
    });
});
