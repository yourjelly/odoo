/** @odoo-module **/

import { localization } from "@web/core/l10n/localization";
import { debounce } from "@web/core/utils/timing";
import { getColor } from "../../colors";
import { useCalendarPopover, useClickHandler, useFullCalendar } from "../../hooks";
import { calculateWeekNumber } from "../../week_utils";
import { CalendarCommonPopover } from "./calendar_common_popover";

const { Component } = owl;
const { onMounted } = owl.hooks;

const SCALE_TO_FC_VIEW = {
    day: "timeGridDay",
    week: "timeGridWeek",
    month: "dayGridMonth",
};
const SCALE_TO_HEADER_FORMAT = {
    day: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("DDD"),
    week: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("EEE d"),
    month: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("EEEE"),
};
const HOUR_FORMATS = {
    12: {
        hour: "numeric",
        minute: "2-digit",
        omitZeroMinute: true,
        meridiem: "short",
    },
    24: {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
    },
};

export class CalendarCommonRenderer extends Component {
    setup() {
        this.fc = useFullCalendar("fullCalendar", this.options);
        this.click = useClickHandler(this.onClick, this.onDblClick);
        this.popover = useCalendarPopover(this.constructor.components.Popover);

        onMounted(() => {
            this.updateSize();
        });
    }

    get options() {
        return {
            allDaySlot: this.props.model.hasAllDaySlot,
            allDayText: this.env._t("All day"),
            columnHeaderFormat: SCALE_TO_HEADER_FORMAT[this.props.model.scale],
            dayNames: luxon.Info.weekdays("long"),
            dayNamesShort: luxon.Info.weekdays("short"),
            dayRender: this.onDayRender,
            defaultDate: this.props.model.date.toJSDate(),
            defaultView: SCALE_TO_FC_VIEW[this.props.model.scale],
            dir: localization.direction,
            droppable: true,
            editable: this.props.model.canEdit,
            eventClick: this.onEventClick,
            eventDragStart: this.onEventDragStart,
            eventDrop: this.onEventDrop,
            eventLimit: this.props.model.eventLimit,
            eventLimitClick: this.onEventLimitClick,
            eventMouseEnter: this.onEventMouseEnter,
            eventMouseLeave: this.onEventMouseLeave,
            eventRender: this.onEventRender,
            eventResizableFromStart: true,
            eventResize: this.onEventResize,
            eventResizeStart: this.onEventResizeStart,
            events: (_, successCb) => successCb(this.mapRecordsToEvents()),
            firstDay: this.props.model.firstDayOfWeek % 7,
            header: false,
            height: "parent",
            locale: "en-US",
            longPressDelay: 500,
            monthNames: luxon.Info.months("long"),
            monthNamesShort: luxon.Info.months("short"),
            navLinks: false,
            nowIndicator: true,
            plugins: ["dayGrid", "interaction", "timeGrid"],
            select: this.onSelect,
            selectAllow: this.isSelectionAllowed,
            selectMirror: true,
            selectable: this.props.model.canCreate,
            slotLabelFormat:
                localization.timeFormat.search("HH") !== -1 ? HOUR_FORMATS[24] : HOUR_FORMATS[12],
            snapDuration: { minutes: 15 },
            unselectAuto: false,
            weekLabel: this.env._t("Week"),
            weekNumberCalculation: calculateWeekNumber,
            weekNumbers: true,
            weekNumbersWithinDays: true,
            windowResize: debounce(this.onWindowResize, 200),
        };
    }

    computeEventSelector(event) {
        return `[data-event-id="${event.id}"]`;
    }
    highlightEvent(event, className) {
        for (const el of this.el.querySelectorAll(this.computeEventSelector(event))) {
            el.classList.add(className);
        }
    }
    unhighlightEvent(event, className) {
        for (const el of this.el.querySelectorAll(this.computeEventSelector(event))) {
            el.classList.remove(className);
        }
    }
    mapRecordsToEvents() {
        return Object.values(this.props.model.records).map((r) => this.convertRecordToEvent(r));
    }
    convertRecordToEvent(record) {
        return {
            id: record.id,
            title: record.title,
            start: record.start.toLocal().toJSDate(),
            end: record.end.toLocal().toJSDate(),
            allDay: record.isAllDay,
        };
    }

    getPopoverProps(record) {
        return {
            record,
            model: this.props.model,
            createRecord: this.props.createRecord,
            deleteRecord: this.props.deleteRecord,
            editRecord: this.props.editRecord,
        };
    }
    openPopover(target, record) {
        this.popover.open(
            target,
            this.getPopoverProps(record),
            `o_cw_popover o-calendar-common-renderer--popover o_calendar_color_${record.colorIndex}`
        );
    }
    updateSize() {
        this.el.style.height = `${window.innerHeight - this.el.offsetTop}px`;
        this.fc.api.updateSize();
    }

    onClick(info) {
        this.openPopover(info.el, this.props.model.records[info.event.id]);
        this.highlightEvent(info.event, "o_cw_custom_highlight");
    }
    onDayRender(info) {
        const date = luxon.DateTime.fromJSDate(info.date).toISODate();
        if (this.props.model.unusualDays.includes(date)) {
            info.el.classList.add("o_calendar_disabled");
        }
    }
    onDblClick(info) {
        this.props.editRecord(this.props.model.records[info.event.id]);
    }

    onEventClick(info) {
        this.click(info);
    }
    onEventRender(info) {
        const { el, event } = info;
        el.dataset.eventId = event.id;
        el.classList.add("o-calendar--event");
        const record = this.props.model.records[event.id];

        if (record) {
            const injectedContentStr = this.env.qweb.renderToString(
                this.constructor.eventTemplate,
                { record }
            );
            const domParser = new DOMParser();
            const injectedContent = domParser.parseFromString(injectedContentStr, "application/xml")
                .documentElement;
            injectedContent.classList.add("fc-content");
            el.replaceChild(injectedContent, el.querySelector(".fc-content"));

            const color = getColor(record.colorIndex);
            if (typeof color === "string") {
                el.style.backgroundColor = color;
            } else if (typeof color === "number") {
                el.classList.add(`o-calendar--event-color-${color}`);
            } else {
                el.classList.add("o-calendar--event-color-1");
            }
        }

        // if (!el.querySelector(".fc-bg")) {
        //     const bg = document.createElement("div");
        //     bg.classList.add("fc-bg");
        //     el.appendChild(bg);
        // }
    }
    onSelect(info) {
        this.fc.api.unselect();
        this.popover.close();
        const keepLocalTime = info.allDay;

        this.props.createRecord({
            start: luxon.DateTime.fromJSDate(info.start).setZone("UTC", { keepLocalTime }),
            end: luxon.DateTime.fromJSDate(info.end).setZone("UTC", { keepLocalTime }),
            isAllDay: info.allDay,
        });
    }
    isSelectionAllowed(event) {
        return event.end.getDate() === event.start.getDate() || event.allDay;
    }
    onEventDrop(info) {
        this.fc.api.unselect();
        const keepLocalTime = info.event.allDay;
        this.props.model.updateRecord({
            id: this.props.model.records[info.event.id].id,
            start: luxon.DateTime.fromJSDate(info.event.start).setZone("UTC", { keepLocalTime }),
            end: luxon.DateTime.fromJSDate(info.event.end).setZone("UTC", { keepLocalTime }),
            isAllDay: info.event.allDay,
        });
    }
    onEventResize(info) {
        this.fc.api.unselect();
        const keepLocalTime = info.event.allDay;
        this.props.model.updateRecord({
            id: this.props.model.records[info.event.id].id,
            start: luxon.DateTime.fromJSDate(info.event.start).setZone("UTC", { keepLocalTime }),
            end: luxon.DateTime.fromJSDate(info.event.end).setZone("UTC", { keepLocalTime }),
            isAllDay: info.event.allDay,
        });
    }
    onEventMouseEnter(info) {
        this.highlightEvent(info.event, "o_cw_custom_highlight");
    }
    onEventMouseLeave(info) {
        if (!info.event.id) {
            return;
        }
        this.unhighlightEvent(info.event, "o_cw_custom_highlight");
    }
    onEventDragStart(info) {
        this.fc.api.unselect();
        this.highlightEvent(info.event, "o_cw_custom_highlight");
    }
    onEventResizeStart(info) {
        this.fc.api.unselect();
        this.highlightEvent(info.event, "o_cw_custom_highlight");
    }
    onEventLimitClick() {
        this.fc.api.unselect();
        return "popover";
    }
    onWindowResize() {
        this.updateSize();
    }
}
CalendarCommonRenderer.components = {
    Popover: CalendarCommonPopover,
};
CalendarCommonRenderer.template = "web.CalendarCommonRenderer";
CalendarCommonRenderer.eventTemplate = "web.CalendarCommonRenderer.event";
