/** @odoo-module **/

import CalendarModel from "web.CalendarModel"

export const TimeOffCalendarModel = CalendarModel.extend({
    calendarEventToRecord() {
        const data = this._super(...arguments);
        data.date_from = data.date_from.utc().startOf('day');
        data.date_to = data.date_to.utc().endOf('day');
        return data;
    }
})
