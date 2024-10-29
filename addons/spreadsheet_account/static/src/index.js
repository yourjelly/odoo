import { _t } from "@web/core/l10n/translation";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { AccountingPlugin } from "./plugins/accounting_plugin";
import { getFirstAccountFunction, getNumberOfAccountFormulas } from "./utils";
import { parseAccountingDate } from "./accounting_functions";
import { camelToSnakeObject } from "@spreadsheet/helpers/helpers";

const { cellMenuRegistry, featurePluginRegistry } = spreadsheet.registries;
const { astToFormula } = spreadsheet;
const { isEvaluationError, toString, toBoolean } = spreadsheet.helpers;

featurePluginRegistry.add("odooAccountingAggregates", AccountingPlugin);

cellMenuRegistry.add("move_lines_see_records", {
    name: _t("See records"),
    sequence: 176,
    async execute(env) {
        const position = env.model.getters.getActivePosition();
        const sheetId = position.sheetId;
        const cell = env.model.getters.getCell(position);
        const { args } = getFirstAccountFunction(cell.compiledFormula.tokens);
        let [codes, date_from, date_to, offset, companyId, includeUnposted] = args
            .map(astToFormula)
            .map((arg) => env.model.getters.evaluateFormulaResult(sheetId, arg));
        codes = toString(codes?.value).split(",");
        const locale = env.model.getters.getLocale();
        let dateFrom;
        try {
            if ( !date_from?.value ) {
                date_from = { value: 1900 }
            }
            dateFrom = parseAccountingDate(date_from, locale);
        } catch {
            dateFrom = parseAccountingDate({ value: 1900 }, locale);
        } 
        let dateTo;
        try {
            if ( !date_to?.value ) {
                date_to = { value: 9999 }
            }
            dateTo = parseAccountingDate(date_to, locale);
        } catch {
            dateTo = parseAccountingDate({ value: 9999 }, locale);
        }
        offset = parseInt(offset?.value) || 0;
        dateFrom.year += offset || 0;
        dateTo.year += offset || 0;
        companyId = parseInt(companyId?.value) || null;
        try {
            includeUnposted = toBoolean(includeUnposted.value);
        } catch {
            includeUnposted = false;
        }

        const action = await env.services.orm.call(
            "account.account",
            "spreadsheet_move_line_action",
            [camelToSnakeObject({ dateFrom, dateTo, companyId, codes, includeUnposted })]
        );
        await env.services.action.doAction(action);
    },
    isVisible: (env) => {
        const position = env.model.getters.getActivePosition();
        const evaluatedCell = env.model.getters.getEvaluatedCell(position);
        const cell = env.model.getters.getCell(position);
        return (
            !isEvaluationError(evaluatedCell.value) &&
            evaluatedCell.value !== "" &&
            cell &&
            cell.isFormula &&
            getNumberOfAccountFormulas(cell.compiledFormula.tokens) === 1
        );
    },
});
