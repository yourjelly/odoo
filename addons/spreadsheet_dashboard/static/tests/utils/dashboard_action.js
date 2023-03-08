/** @odoo-module */

import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { getDashboardServerData } from "./data";
import { spreadsheetServerDataService } from "@spreadsheet/data/data_service";
import { registry } from "@web/core/registry";

/**
 * @param {object} params
 * @param {object} [params.serverData]
 * @param {function} [params.mockRPC]
 * @param {number} [params.spreadsheetId]
 * @returns {Promise}
 */
export async function createSpreadsheetDashboard(params = {}) {
    registry.category("services").add("spreadsheet_server_data", spreadsheetServerDataService);
    const webClient = await createWebClient({
        serverData: params.serverData || getDashboardServerData(),
        mockRPC: params.mockRPC,
    });
    return await doAction(webClient, {
        type: "ir.actions.client",
        tag: "action_spreadsheet_dashboard",
        params: {
            dashboard_id: params.spreadsheetId,
        },
    });
}
