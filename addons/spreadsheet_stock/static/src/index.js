/** @odoo-module */

import { _lt } from "@web/core/l10n/translation";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import StockPlugin from "./plugins/stock_plugins";
import { getFirstStockFunction, getNumberOfStockFormulas } from "./utils";
import { parseStockDate } from "./stock_functions";
import { camelToSnakeObject } from "@spreadsheet/helpers/helpers";

const { cellMenuRegistry, uiPluginRegistry } = spreadsheet.registries;
const { astToFormula } = spreadsheet;

uiPluginRegistry.add("odooStockAggregates", StockPlugin);

cellMenuRegistry.add("stock_lines_see_records", {
    name: _lt("See stock records"),
    sequence: 177,
    async action(env) {
        const cell = env.model.getters.getActiveCell();
        const { args } = getFirstStockFunction(cell.content);
        let [location_id, product_id, date_range, posted] = args
            .map(astToFormula)
            .map((arg) => env.model.getters.evaluateFormula(arg));
        const dateRange = parseStockDate(date_range);

        const action = await env.services.orm.call(
            "stock.move.line",
            "spreadsheet_stock_line_action",
            camelToSnakeObject({ dateRange, location_id, product_id, posted })
        );
        await env.services.action.doAction(action);
    },
    isVisible: (env) => {
        const cell = env.model.getters.getActiveCell();
        return (
            cell &&
            !cell.evaluated.error &&
            cell.evaluated.value !== "" &&
            getNumberOfStockFormulas(cell.content) === 1
        );
    },
});
