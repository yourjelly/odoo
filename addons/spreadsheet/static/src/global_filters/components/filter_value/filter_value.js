/** @odoo-module */

import { MultiRecordSelector } from "@web/core/selectors/selectors";
import { RELATIVE_DATE_RANGE_TYPES } from "@spreadsheet/helpers/constants";
import { DateFilterValue } from "../filter_date_value/filter_date_value";

import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

export class FilterValue extends Component {
    setup() {
        this.nameService = useService("name");
        this.getters = this.props.model.getters;
        this.relativeDateRangesTypes = RELATIVE_DATE_RANGE_TYPES;
    }
    onDateInput(id, value) {
        this.props.model.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
    }

    onTextInput(id, value) {
        this.props.model.dispatch("SET_GLOBAL_FILTER_VALUE", { id, value });
    }

    async onTagSelected(filter, resIds) {
        const id = filter.id;
        const records = await this.nameService.loadDisplayNames(filter.modelName, resIds);
        this.props.model.dispatch("SET_GLOBAL_FILTER_VALUE", {
            id,
            value: resIds,
            displayNames: Object.values(records),
        });
    }

    translate(text) {
        return _t(text);
    }

    onClear(id) {
        this.props.model.dispatch("CLEAR_GLOBAL_FILTER_VALUE", { id });
    }
}
FilterValue.template = "spreadsheet_edition.FilterValue";
FilterValue.components = { MultiRecordSelector, DateFilterValue };
FilterValue.props = {
    filter: Object,
    model: Object,
};
