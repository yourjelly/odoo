/** @odoo-module **/

import { CalendarCommonRenderer } from "./common/calendar_common_renderer";
import { CalendarYearRenderer } from "./year/calendar_year_renderer";

const { Component } = owl;

export class Calendar extends Component {
    get calendarComponent() {
        return this.constructor.components[this.props.model.scale];
    }
    get calendarKey() {
        return `${this.props.model.scale}_${this.props.model.date.valueOf()}`;
    }
}
Calendar.components = {
    day: CalendarCommonRenderer,
    week: CalendarCommonRenderer,
    month: CalendarCommonRenderer,
    year: CalendarYearRenderer,
};
Calendar.template = "web.Calendar";
