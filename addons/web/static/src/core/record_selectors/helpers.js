/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { formatAST, toPyValue } from "@web/core/py_js/py_utils";
import { Expression } from "@web/core/domain_tree";

export const isId = (val) => Number.isInteger(val) && val >= 1;

export const getFormat = (val, displayNames) => {
    let text;
    let colorIndex;
    if (isId(val)) {
        text =
            typeof displayNames[val] === "string"
                ? displayNames[val]
                : _t("Inaccessible/missing record ID: %s", val);
        colorIndex = typeof displayNames[val] === "string" ? 0 : 2; // 0 = grey, 2 = orange
    } else {
        text =
            val instanceof Expression
                ? String(val)
                : _t("Invalid record ID: %s", formatAST(toPyValue(val)));
        colorIndex = val instanceof Expression ? 2 : 1; // 1 = red
    }
    return { text, colorIndex };
};
