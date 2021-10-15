/** @odoo-module **/

import { useEffect } from "@web/core/utils/hooks";
import { calculateWeekNumber } from "../week_utils";

const { Component } = owl;
const { xml } = owl.tags;

// This component uses JQuery!
// Should we find another lib for date picker?
// Or write our own date picker?
export class CalendarDatePicker extends Component {
    setup() {
        useEffect(() => {
            this.highlight();
        });
    }
    mounted() {
        this.$el.datepicker(this.options);
    }
    willUnmount() {
        this.$el.datepicker("destroy");
        const picker = document.querySelector("#ui-datepicker-div:empty");
        if (picker) {
            picker.remove();
        }
    }

    get dayNamesMin() {
        // I think this is totally wrong!
        // why this func: names are in wrong order without it
        const weekdays = Array.from(luxon.Info.weekdays("narrow"));
        const last = weekdays.pop();
        return [last, ...weekdays];
    }
    get options() {
        return {
            dayNamesMin: this.dayNamesMin,
            firstDay: (this.props.model.firstDayOfWeek || 0) % 7,
            monthNames: luxon.Info.months("short"),
            onSelect: this.onDateSelected.bind(this),
            showOtherMonths: true,
            calculateWeek: calculateWeekNumber,
        };
    }
    get $el() {
        return $(this.el);
    }

    highlight() {
        this.$el
            .datepicker("setDate", this.props.model.date.toJSDate())
            .find(".o-selected-range")
            .removeClass("o-color o-selected-range");
        let $a;
        switch (this.props.model.scale) {
            case "year":
                $a = this.$el.find("td");
                break;
            case "month":
                $a = this.$el.find("td");
                break;
            case "week":
                $a = this.$el.find("tr:has(.ui-state-active)");
                break;
            case "day":
                $a = this.$el.find("a.ui-state-active");
                break;
        }
        $a.addClass("o-selected-range");
        $a.not(".ui-state-active").addClass("o-color");
    }

    onDateSelected(_, info) {
        const model = this.props.model;
        const date = luxon.DateTime.utc(
            +info.currentYear,
            +info.currentMonth + 1,
            +info.currentDay
        );
        let scale = "week";

        if (model.date.hasSame(date, "day")) {
            const rs = model.scales.slice().reverse();
            scale = rs[(rs.indexOf(model.scale) + 1) % rs.length];
        } else {
            const currentDate = model.date.set({
                weekday:
                    model.date.weekday < model.firstDayOfWeek
                        ? model.firstDayOfWeek - 7
                        : model.firstDayOfWeek,
            });
            const pickedDate = date.set({
                weekday:
                    date.weekday < model.firstDayOfWeek
                        ? model.firstDayOfWeek - 7
                        : model.firstDayOfWeek,
            });

            // a.hasSame(b, "week") does not depend on locale and week alway starts on Monday
            if (currentDate.hasSame(pickedDate, "week")) {
                scale = "day";
            }
        }

        model.load({ scale, date });
    }
}
CalendarDatePicker.props = {
    model: Object,
};
CalendarDatePicker.template = xml`<div class="o-calendar-date-picker" />`;
