/** @odoo-module */

import {
    deserializeDate,
    deserializeDateTime,
    parseDate,
    parseDateTime,
} from "@web/core/l10n/dates";
import PublicWidget from "@web/legacy/js/public/public_widget";

export const DateTimePickerWidget = PublicWidget.Widget.extend({
    selector: "[data-widget='datetime-picker']",
    init() {
        this._super(...arguments);
        this.datetimePicker = this.bindService("datetime_picker");
    },
    start() {
        this._super(...arguments);
        const { widgetType, minDate, maxDate } = this.el.dataset;
        const type = widgetType || "datetime";
        const { value } = this.el;
        const [parse, deserialize] =
            type === "date" ? [parseDate, deserializeDate] : [parseDateTime, deserializeDateTime];
        this.disable = this.datetimePicker
            .create({
                target: this.el,
                pickerProps: {
                    type,
                    minDate: minDate && deserialize(minDate),
                    maxDate: maxDate && deserialize(maxDate),
                    value: parse(value),
                },
            })
            .enable();
    },
    destroy() {
        this.disable();
        return this._super(...arguments);
    },
});

PublicWidget.registry.DateTimePickerWidget = DateTimePickerWidget;
