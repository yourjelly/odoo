/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";

export const OPERATOR_DESCRIPTIONS = [
    // valid operators (see TERM_OPERATORS in expression.py)
    { key: "equal", label: "=", symbol: "=", valueCount: 1 },
    { key: "not_equal", label: "!=", symbol: "!=", valueCount: 1 },
    { key: "less_equal", label: "<=", symbol: "<=", valueCount: 1 },
    { key: "less_than", label: "<", symbol: "<", valueCount: 1 },
    { key: "greater_than", label: ">", symbol: ">", valueCount: 1 },
    { key: "greater_equal", label: ">=", symbol: ">=", valueCount: 1 },
    { key: "equal_question", label: "=?", symbol: "=?", valueCount: 1 },
    { key: "equal_like", label: _t("=like"), symbol: "=like", valueCount: 1 },
    { key: "equal_ilike", label: _t("=ilike"), symbol: "=ilike", valueCount: 1 },
    { key: "like", label: _t("like"), symbol: "like", valueCount: 1 },
    { key: "not_like", label: _t("not like"), symbol: "not like", valueCount: 1 },
    { key: "ilike", label: _t("contains"), symbol: "ilike", valueCount: 1 },
    { key: "not_ilike", label: _t("does not contain"), symbol: "not ilike", valueCount: 1 },
    { key: "in", label: _t("in"), symbol: "in", valueCount: "variable" },
    { key: "not_in", label: _t("not in"), symbol: "not in", valueCount: "variable" },
    { key: "child_of", label: _t("child of"), symbol: "child_of", valueCount: 1 },
    { key: "parent_of", label: _t("parent of"), symbol: "parent_of", valueCount: 1 },

    // virtual operators (replace = and != in some cases)
    { key: "is", label: _t("is"), symbol: "=", valueCount: 1 },
    { key: "is_not", label: _t("is not"), symbol: "!=", valueCount: 1 },
    { key: "set", label: _t("is set"), symbol: "!=", valueCount: 0 },
    { key: "not_set", label: _t("is not set"), symbol: "=", valueCount: 0 },

    // virtual operator (equivalent to a couple (>=,<=))
    { key: "between", label: _t("is between"), symbol: "between", valueCount: 2 },
];

export function findOperator(key) {
    return OPERATOR_DESCRIPTIONS.find((op) => op.key === key);
}

export function selectOperators(keys) {
    const operators = Object.fromEntries(OPERATOR_DESCRIPTIONS.map((op) => [op.key, op]));
    return keys.map((key) => operators[key]);
}

export function parseOperator(symbol) {
    return OPERATOR_DESCRIPTIONS.filter(
        (op) => !["is", "is_not", "set", "not_set"].includes(op.key)
    ).find((op) => op.symbol === symbol);
}
