/** @odoo-module */

// import { ormService } from "@web/core/orm_service";
// import { registry } from "@web/core/registry";
// import { makeFakeLocalizationService } from "@web/../tests/legacy/helpers/mock_services";

import { Model } from "@odoo/o-spreadsheet";
import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
// import { nameService } from "@web/core/name_service";
import { OdooDataProvider } from "@spreadsheet/data_sources/odoo_data_provider";
import { animationFrame } from "@odoo/hoot-mock";
import { makeMockEnv } from "@web/../tests/web_test_helpers";

/**
 * @typedef {import("@spreadsheet/../tests/legacy/utils/data").ServerData} ServerData
 * @typedef {import("@spreadsheet/o_spreadsheet/o_spreadsheet").Model} Model
 */

export function setupDataSourceEvaluation(model) {
    model.config.custom.odooDataProvider.addEventListener("data-source-updated", () => {
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("EVALUATE_CELLS", { sheetId });
    });
}

/**
 * Create a spreadsheet model with a mocked server environnement
 *
 * @param {object} params
 * @param {object} [params.spreadsheetData] Spreadsheet data to import
 * @param {object} [params.modelConfig]
 * @param {ServerData} [params.serverData] Data to be injected in the mock server
 * @param {function} [params.mockRPC] Mock rpc function
 */
export async function createModelWithDataSource(params = {}) {
    // mockService("orm", ormService);
    // mockService("name", nameService);
    // registry
    //     .category("services")
    //     .add("localization", makeFakeLocalizationService(), { force: true });
    const env = await makeMockEnv({
        serverData: params.serverData || getBasicServerData(),
        mockRPC: params.mockRPC,
    });
    const config = params.modelConfig;
    const model = new Model(params.spreadsheetData, {
        ...config,
        custom: {
            env,
            odooDataProvider: new OdooDataProvider(env),
            ...config?.custom,
        },
    });
    setupDataSourceEvaluation(model);
    await animationFrame(); // initial async formulas loading
    return model;
}
