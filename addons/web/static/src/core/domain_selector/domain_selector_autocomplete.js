/** @odoo-module **/

import { MultiRecordSelector } from "../record_selectors/multi_record_selector";
import { _t } from "@web/core/l10n/translation";
import { formatAST, toPyValue } from "@web/core/py_js/py_utils";
import { Expression } from "@web/core/domain_tree";
import { RecordSelector } from "../record_selectors/record_selector";

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

export class DomainSelectorAutocomplete extends MultiRecordSelector {
    static props = {
        ...MultiRecordSelector.props,
        value: true,
    };

    getIds(props = this.props) {
        return props.value.filter((val) => isId(val));
    }

    getTags(props, displayNames) {
        return props.value.map((val, index) => {
            const { text, colorIndex } = getFormat(val, displayNames);
            return {
                text,
                colorIndex,
                onDelete: () => {
                    this.props.update([
                        ...this.props.value.slice(0, index),
                        ...this.props.value.slice(index + 1),
                    ]);
                },
            };
        });
    }
}

export class DomainSelectorSingleAutocomplete extends RecordSelector {
    static props = {
        ...RecordSelector.props,
        value: true,
    };

    getDisplayName(props = this.props, displayNames) {
        const { value } = props;
        if (value === false) {
            return "";
        }
        const { text } = getFormat(value, displayNames);
        return text;
    }

    getIds(props = this.props) {
        if (isId(props.value)) {
            return [props.value];
        }
        return [];
    }
}
