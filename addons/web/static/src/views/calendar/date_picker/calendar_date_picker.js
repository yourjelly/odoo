/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { DateTimePicker } from "@web/core/datetime/datetime_picker";
import { getStartOfWeek } from "@web/core/l10n/dates";
import { Model } from "@web/views/model";

const RANGE_CLASSNAME = "o_selected_range";
const SCALES = ["month", "week", "day"];

export class CalendarDatePicker extends Component {
    static components = { DateTimePicker };

    static props = {
        model: Model,
    };

    static template = "web.CalendarDatePicker";

    get ranges() {
        const { value } = this.state;
        const { scale } = this.props.model;
        const ranges = {};
        if (scale === "week") {
            const startOfWeek = getStartOfWeek(value);
            ranges[RANGE_CLASSNAME] = [startOfWeek, startOfWeek.plus({ days: 6 }).endOf("day")];
        } else if (scale !== "day") {
            ranges[RANGE_CLASSNAME] = [value.startOf(scale), value.endOf(scale)];
        }
        return ranges;
    }

    setup() {
        this.state = useState({
            value: this.props.model.meta.date,
        });
    }

    onDateSelected(date) {
        const { model } = this.props;

        let scale = "week";
        if (model.date.hasSame(date, "day")) {
            scale = SCALES[(SCALES.indexOf(model.scale) + 1) % SCALES.length];
        } else if (getStartOfWeek(model.date) === getStartOfWeek(date)) {
            scale = "day";
        }

        this.state.value = date;
        model.load({ scale, date });
    }
}
