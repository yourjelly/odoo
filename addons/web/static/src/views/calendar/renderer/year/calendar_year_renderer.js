/** @odoo-module **/

import { localization } from "@web/core/l10n/localization";
import { getColor } from "../../colors";
import { useCalendarPopover, useFullCalendar } from "../../hooks";
import { calculateWeekNumber } from "../../week_utils";
import { CalendarYearPopover } from "./calendar_year_popover";

const { Component } = owl;

export class CalendarYearRenderer extends Component {
    setup() {
        this.months = luxon.Info.months();
        this.fcs = {};
        for (const month of this.months) {
            this.fcs[month] = useFullCalendar(
                `fullCalendar-${month}`,
                this.getOptionsForMonth(month)
            );
        }
        this.popover = useCalendarPopover(this.constructor.components.Popover);
    }

    get options() {
        return {
            columnHeaderFormat: (info) =>
                luxon.DateTime.fromJSDate(info.date.marker).toFormat("EEEEE"),
            contentHeight: 0,
            dateClick: this.onDateClick,
            dayNames: luxon.Info.weekdays("long"),
            dayNamesShort: luxon.Info.weekdays("short"),
            dayRender: this.onDayRender,
            defaultDate: this.props.model.date.toJSDate(),
            defaultView: "dayGridMonth",
            dir: localization.direction,
            droppable: true,
            editable: this.props.model.canEdit,
            eventLimit: this.props.model.eventLimit,
            eventRender: this.onEventRender,
            eventResizableFromStart: true,
            events: (_, successCb) => successCb(this.mapRecordsToEvents()),
            firstDay: this.props.model.firstDayOfWeek,
            header: { left: false, center: "title", right: false },
            height: 0,
            locale: "en-US",
            longPressDelay: 500,
            monthNames: luxon.Info.months("long"),
            monthNamesShort: luxon.Info.months("short"),
            navLinks: false,
            nowIndicator: true,
            plugins: ["dayGrid", "interaction"],
            select: this.onSelect,
            selectMinDistance: 5, // needed to not trigger select when click
            selectMirror: true,
            selectable: this.props.model.canCreate,
            showNonCurrentDates: false,
            titleFormat: { month: "short", year: "numeric" },
            unselectAuto: false,
            weekNumberCalculation: calculateWeekNumber,
            weekNumbers: false,
        };
    }

    mapRecordsToEvents() {
        return Object.values(this.props.model.records).map((r) => this.convertRecordToEvent(r));
    }
    convertRecordToEvent(record) {
        return {
            id: record.id,
            title: record.title,
            start: record.start.toLocal().startOf("days").toJSDate(),
            end: record.end.toLocal().startOf("days").plus({ days: 1 }).toJSDate(),
            allDay: true,
            rendering: "background",
        };
    }
    getDateWithMonth(month) {
        return this.props.model.date.set({ month: this.months.indexOf(month) + 1 }).toJSDate();
    }
    getOptionsForMonth(month) {
        return {
            ...this.options,
            defaultDate: this.getDateWithMonth(month),
        };
    }

    getPopoverProps(date, records) {
        return {
            date,
            records,
            model: this.props.model,
            createRecord: this.props.createRecord,
            deleteRecord: this.props.deleteRecord,
            editRecord: this.props.editRecord,
        };
    }
    openPopover(target, date, records) {
        this.popover.open(
            target,
            this.getPopoverProps(date, records),
            `o-calendar-year-renderer--popover`
        );
    }
    unselect() {
        for (const fc of Object.values(this.fcs)) {
            fc.api.unselect();
        }
    }

    onDateClick(info) {
        const date = luxon.DateTime.fromJSDate(info.date).setZone("UTC", { keepLocalTime: true });
        const records = Object.values(this.props.model.records).filter((r) => {
            return luxon.Interval.fromDateTimes(
                r.start.toLocal().startOf("day"),
                r.end.toLocal().endOf("day")
            ).contains(date);
        });

        if (records.length) {
            const target = info.dayEl;
            this.openPopover(target, date, records);
        } else {
            this.popover.close();
            this.props.createRecord({
                start: luxon.DateTime.fromJSDate(info.date).setZone("UTC", { keepLocalTime: true }),
                isAllDay: true,
            });
        }
    }
    onDayRender(info) {
        const date = luxon.DateTime.fromJSDate(info.date).toISODate();
        if (this.props.model.unusualDays.includes(date)) {
            info.el.classList.add("o_calendar_disabled");
        }
    }
    onEventRender(info) {
        const { el, event } = info;
        el.dataset.eventId = event.id;
        el.classList.add("o-calendar--event");
        const record = this.props.model.records[event.id];
        if (record) {
            const color = getColor(record.colorIndex);
            if (typeof color === "string") {
                el.style.backgroundColor = color;
            } else if (typeof color === "number") {
                el.classList.add(`o-calendar--event-color-${color}`);
            } else {
                el.classList.add("o-calendar--event-color-1");
            }
        }
    }
    onSelect(info) {
        this.unselect();
        this.props.createRecord({
            start: luxon.DateTime.fromJSDate(info.start).setZone("UTC", { keepLocalTime: true }),
            end: luxon.DateTime.fromJSDate(info.end).setZone("UTC", { keepLocalTime: true }),
            isAllDay: true,
        });
    }
}
CalendarYearRenderer.components = {
    Popover: CalendarYearPopover,
};
CalendarYearRenderer.template = "web.CalendarYearRenderer";
