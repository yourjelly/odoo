/** @odoo-module **/
import { getOdooFunctions } from "@spreadsheet/helpers/odoo_functions_helpers";

/** @typedef  {import("@spreadsheet/helpers/odoo_functions_helpers").OdooFunctionDescription} OdooFunctionDescription*/

/**
 * @param {string} formula
 * @returns {number}
 */
export function getNumberOfStockFormulas(formula) {
    return getOdooFunctions(formula, ["ODOO.STOCK"]).filter(
        (fn) => fn.isMatched
    ).length;
}

/**
 * Get the first Stock function description of the given formula.
 *
 * @param {string} formula
 * @returns {OdooFunctionDescription | undefined}
 */
export function getFirstStockFunction(formula) {
    return getOdooFunctions(formula, ["ODOO.STOCK"]).find(
        (fn) => fn.isMatched
    );
}
