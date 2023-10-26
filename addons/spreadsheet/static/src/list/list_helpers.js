/** @odoo-module */

import { memoize } from "@web/core/utils/functions";
import { getOdooFunctions } from "../helpers/odoo_functions_helpers";

/**
 * Parse a spreadsheet formula and detect the number of LIST functions that are
 * present in the given formula.
 *
 * @param {string} formula
 *
 * @returns {number}
 */
export const getNumberOfListFormulas = memoize(function getNumberOfListFormulas(formula) {
    return getOdooFunctions(formula, ["ODOO.LIST", "ODOO.LIST.HEADER"]).length;
});

/**
 * Get the first List function description of the given formula.
 *
 * @param {string} formula
 *
 * @returns {import("../helpers/odoo_functions_helpers").OdooFunctionDescription|undefined}
 */
export const getFirstListFunction = memoize(function getFirstListFunction(formula) {
    return getOdooFunctions(formula, ["ODOO.LIST", "ODOO.LIST.HEADER"])[0];
});
