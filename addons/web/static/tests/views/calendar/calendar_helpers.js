/** @odoo-module **/

import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { uiService } from "@web/core/ui/ui_service";
import { ormService } from "@web/core/orm_service";
import { popoverService } from "@web/core/popover/popover_service";
import { registry } from "@web/core/registry";
import { registerCleanup } from "../../helpers/cleanup";
import { clearRegistryWithCleanup, makeTestEnv } from "../../helpers/mock_env";
import { makeFakeLocalizationService } from "../../helpers/mock_services";
import { click, getFixture, nextTick, patchWithCleanup, triggerEvent } from "../../helpers/utils";
import { session } from "@web/session";

export function makeEnv(services = {}) {
    clearRegistryWithCleanup(registry.category("main_components"));
    services = Object.assign(
        {
            localization: makeFakeLocalizationService(),
            orm: ormService,
            popover: popoverService,
            ui: uiService,
            hotkey: hotkeyService,
        },
        services
    );

    for (const [key, service] of Object.entries(services)) {
        registry.category("services").add(key, service);
    }

    return makeTestEnv();
}

//------------------------------------------------------------------------------

class Wrapper extends owl.Component {
    setup() {
        this.subProps = { ...this.props.props };
    }
    async updateProps(action) {
        action(this.subProps);
        this.render();
        await nextTick();
    }
}
Wrapper.components = { MainComponentsContainer };
Wrapper.template = owl.tags.xml`
    <div class="wrapper">
        <t t-component="props.Component" t-props="subProps" />
        <MainComponentsContainer />
    </div>
`;

export async function mountComponent(C, env, props) {
    const target = getFixture();
    const component = await owl.mount(Wrapper, {
        target,
        env,
        props: {
            Component: C,
            props,
        },
    });
    registerCleanup(() => component.destroy());
    return component;
}

//------------------------------------------------------------------------------

export const FAKE_DATE = luxon.DateTime.utc(2021, 7, 16, 8, 0, 0, 0);

export const FAKE_RECORDS = {
    1: {
        id: 1,
        title: "1 day, all day in July",
        start: FAKE_DATE,
        isAllDay: true,
        end: FAKE_DATE,
    },
    2: {
        id: 2,
        title: "3 days, all day in July",
        start: FAKE_DATE.plus({ days: 2 }),
        isAllDay: true,
        end: FAKE_DATE.plus({ days: 4 }),
    },
    3: {
        id: 3,
        title: "1 day, all day in June",
        start: FAKE_DATE.plus({ months: -1 }),
        isAllDay: true,
        end: FAKE_DATE.plus({ months: -1 }),
    },
    4: {
        id: 4,
        title: "3 days, all day in June",
        start: FAKE_DATE.plus({ months: -1, days: 2 }),
        isAllDay: true,
        end: FAKE_DATE.plus({ months: -1, days: 4 }),
    },
    5: {
        id: 5,
        title: "Over June and July",
        start: FAKE_DATE.startOf("month").plus({ days: -2 }),
        isAllDay: true,
        end: FAKE_DATE.startOf("month").plus({ days: 2 }),
    },
};

export const FAKE_FILTER_SECTIONS = [
    {
        label: "Attendees",
        fieldName: "partner_ids",
        avatar: {
            model: "res.partner",
            field: "avatar_128",
        },
        hasAvatar: true,
        write: {
            model: "filter_partner",
            field: "partner_id",
        },
        canCollapse: true,
        canAddFilter: true,
        filters: [
            {
                type: "user",
                label: "Mitchell Admin",
                active: true,
                value: 3,
                colorIndex: 3,
                recordId: null,
                canRemove: false,
                hasAvatar: true,
            },
            {
                type: "all",
                label: "Everybody's calendar",
                active: false,
                value: "all",
                colorIndex: null,
                recordId: null,
                canRemove: false,
                hasAvatar: false,
            },
            {
                type: "record",
                label: "Brandon Freeman",
                active: true,
                value: 4,
                colorIndex: 4,
                recordId: 1,
                canRemove: true,
                hasAvatar: true,
            },
            {
                type: "record",
                label: "Marc Demo",
                active: false,
                value: 6,
                colorIndex: 6,
                recordId: 2,
                canRemove: true,
                hasAvatar: true,
            },
        ],
    },
    {
        label: "Users",
        fieldName: "user_id",
        avatar: {
            model: null,
            field: null,
        },
        hasAvatar: false,
        write: {
            model: null,
            field: null,
        },
        canCollapse: false,
        canAddFilter: false,
        filters: [
            {
                type: "record",
                label: "Brandon Freeman",
                active: false,
                value: 1,
                colorIndex: false,
                recordId: null,
                canRemove: true,
                hasAvatar: true,
            },
            {
                type: "record",
                label: "Marc Demo",
                active: false,
                value: 2,
                colorIndex: false,
                recordId: null,
                canRemove: true,
                hasAvatar: true,
            },
        ],
    },
];

export const FAKE_FIELDS = {
    id: { string: "Id", type: "integer" },
    user_id: { string: "User", type: "many2one", relation: "user", default: -1 },
    partner_id: {
        string: "Partner",
        type: "many2one",
        relation: "partner",
        related: "user_id.partner_id",
        default: 1,
    },
    name: { string: "Name", type: "char" },
    start_date: { string: "Start Date", type: "date" },
    stop_date: { string: "Stop Date", type: "date" },
    start: { string: "Start Datetime", type: "datetime" },
    stop: { string: "Stop Datetime", type: "datetime" },
    delay: { string: "Delay", type: "float" },
    allday: { string: "Is All Day", type: "boolean" },
    partner_ids: {
        string: "Attendees",
        type: "one2many",
        relation: "partner",
        default: [[6, 0, [1]]],
    },
    type: { string: "Type", type: "integer" },
    event_type_id: { string: "Event Type", type: "many2one", relation: "event_type" },
    color: { string: "Color", type: "integer", related: "event_type_id.color" },
};

export const FAKE_POPOVER_FIELDS = {
    name: { attrs: {} },
};

export const FAKE_MODEL_STATE = {
    canCreate: true,
    canDelete: true,
    canEdit: true,
    date: FAKE_DATE,
    fieldMapping: {
        date_start: "start_date",
        date_stop: "stop_date",
        date_delay: "delay",
        all_day: "allday",
        color: "color",
    },
    fieldNames: ["start_date", "stop_date", "color", "delay", "allday", "user_id"],
    fields: FAKE_FIELDS,
    filterSections: FAKE_FILTER_SECTIONS,
    firstDayOfWeek: 0,
    isDateHidden: false,
    isTimeHidden: false,
    hasAllDaySlot: true,
    hasEditDialog: false,
    hasQuickCreate: false,
    popoverFields: FAKE_POPOVER_FIELDS,
    rangeEnd: FAKE_DATE.endOf("month"),
    rangeStart: FAKE_DATE.startOf("month"),
    records: FAKE_RECORDS,
    resModel: "event",
    scale: "month",
    scales: ["day", "week", "month", "year"],
    unusualDays: [],
};

export function makeFakeModel(state = {}) {
    return {
        ...FAKE_MODEL_STATE,
        load() {},
        createFilter() {},
        createRecord() {},
        unlinkFilter() {},
        unlinkRecord() {},
        updateFilter() {},
        updateRecord() {},
        ...state,
    };
}

// DOM Utils
//------------------------------------------------------------------------------

async function scrollTo(el, scrollParam) {
    el.scrollIntoView(scrollParam);
    await new Promise(window.requestAnimationFrame);
}

export function findPickedDate(calendar) {
    return calendar.el.querySelector(".ui-datepicker-current-day");
}

export async function pickDate(calendar, date) {
    const [year, month, day] = date.split("-");
    const iMonth = parseInt(month, 10) - 1;
    const iDay = parseInt(day, 10) - 1;
    const el = calendar.el.querySelectorAll(
        `.ui-datepicker-calendar td[data-year="${year}"][data-month="${iMonth}"]`
    )[iDay];
    el.scrollIntoView();
    await click(el);
}

function findAllDaySlot(calendar, date) {
    return calendar.el.querySelector(`.fc-day-grid .fc-day[data-date="${date}"]`);
}

function findDateCell(calendar, date) {
    return calendar.el.querySelector(`.fc-day-top[data-date="${date}"]`);
}

export function findEvent(calendar, eventId) {
    return calendar.el.querySelector(`.o-calendar--event[data-event-id="${eventId}"]`);
}

function findDateCol(calendar, date) {
    return calendar.el.querySelector(`.fc-day-header[data-date="${date}"]`);
}

export function findTimeRow(calendar, time) {
    return calendar.el.querySelector(`.fc-slats [data-time="${time}"] .fc-widget-content`);
}

async function triggerEventForCalendar(el, type, position = {}) {
    const rect = el.getBoundingClientRect();
    const x = position.x || rect.x;
    const y = position.y || rect.y;
    const attrs = {
        which: 1,
        pageX: x + 1,
        layerX: x + 1,
        screenX: x + 1,
        pageY: y,
        layerY: y,
        screenY: y,
    };
    await triggerEvent(el, null, type, attrs);
}

export async function clickAllDaySlot(calendar, date) {
    const el = findAllDaySlot(calendar, date);
    await scrollTo(el);
    await triggerEventForCalendar(el, "mousedown");
    await triggerEventForCalendar(el, "mouseup");
}

export async function clickDate(calendar, date) {
    const el = findDateCell(calendar, date);
    await scrollTo(el);
    await triggerEventForCalendar(el, "mousedown");
    await triggerEventForCalendar(el, "mouseup");
}

export async function clickEvent(calendar, eventId) {
    const el = findEvent(calendar, eventId);
    await scrollTo(el);
    await click(el);
}

export async function selectTimeRange(calendar, startDateTime, endDateTime) {
    const [startDate, startTime] = startDateTime.split(" ");
    const [endDate, endTime] = endDateTime.split(" ");

    const startCol = findDateCol(calendar, startDate);
    const endCol = findDateCol(calendar, endDate);
    const startRow = findTimeRow(calendar, startTime);
    const endRow = findTimeRow(calendar, endTime);

    await scrollTo(startRow);
    const startColRect = startCol.getBoundingClientRect();
    const startRowRect = startRow.getBoundingClientRect();

    await triggerEventForCalendar(startRow, "mousedown", {
        x: startColRect.x,
        y: startRowRect.y + 1,
    });

    await scrollTo(endRow, false);
    const endColRect = endCol.getBoundingClientRect();
    const endRowRect = endRow.getBoundingClientRect();

    await triggerEventForCalendar(endRow, "mousemove", { x: endColRect.x, y: endRowRect.y - 1 });
    await triggerEventForCalendar(endRow, "mouseup", { x: endColRect.x, y: endRowRect.y - 1 });
}

export async function selectDateRange(calendar, startDate, endDate) {
    const start = findDateCell(calendar, startDate);
    const end = findDateCell(calendar, endDate);
    await scrollTo(start);
    await triggerEventForCalendar(start, "mousedown");
    await scrollTo(end);
    await triggerEventForCalendar(end, "mousemove");
    await triggerEventForCalendar(end, "mouseup");
}

export async function selectAllDayRange(calendar, start, end) {}

export async function moveEventToDate(calendar, eventId, date, options = {}) {
    const event = findEvent(calendar, eventId);
    const cell = findDateCell(calendar, date);

    await scrollTo(event);
    await triggerEventForCalendar(event, "mousedown");

    await scrollTo(cell);
    await triggerEventForCalendar(cell, "mousemove");

    if (!options.disableDrop) {
        await triggerEventForCalendar(cell, "mouseup");
    }
}

export async function moveEventToTime(calendar, eventId, dateTime) {
    const event = findEvent(calendar, eventId);
    const [date, time] = dateTime.split(" ");

    const col = findDateCol(calendar, date);
    const row = findTimeRow(calendar, time);

    await scrollTo(event);
    await triggerEventForCalendar(event, "mousedown");

    // todo
}

export async function moveEventToAllDaySlot(calendar, eventId, date) {}

/**
 * @param {owl.Component} calendarView
 * @param {"day" | "week" | "month" | "year"} scale
 */
export async function changeScale(calendarView, scale) {
    await click(
        calendarView.el,
        `.o-calendar-view--scale-buttons .o-calendar-view--scale-button--${scale}`
    );
}

/**
 * @param {owl.Component} calendarView
 * @param {"previous" | "next" | "today"} direction
 */
export async function navigate(calendarView, direction) {
    await click(
        calendarView.el,
        `.o-calendar-view--navigation-buttons .o-calendar-view--navigation-button--${direction}`
    );
}

export function findFilterPanelSection(calendar, sectionName) {
    return calendar.el.querySelector(
        `.o-calendar-filter-panel--section[data-name="${sectionName}"]`
    );
}

export function findFilterPanelFilter(calendar, sectionName, filterValue) {
    return findFilterPanelSection(calendar, sectionName).querySelector(
        `.o-calendar-filter-panel--filter[data-value="${filterValue}"]`
    );
}

export function findFilterPanelSectionFilter(calendar, sectionName) {
    return findFilterPanelSection(calendar, sectionName).querySelector(
        `.o-calendar-filter-panel--section-filter`
    );
}

export async function toggleFilter(calendar, sectionName, filterValue) {
    const el = findFilterPanelFilter(calendar, sectionName, filterValue).querySelector(
        `.o-calendar-filter-panel--filter-input`
    );
    await scrollTo(el);
    await click(el);
}

export async function toggleSectionFilter(calendar, sectionName) {
    const el = findFilterPanelSectionFilter(calendar, sectionName).querySelector(
        `.o-calendar-filter-panel--filter-input`
    );
    await scrollTo(el);
    await click(el);
}

export function patchTimeZone(afterUTCOffset) {
    const originalZone = luxon.Settings.defaultZone;
    luxon.Settings.defaultZone = new luxon.FixedOffsetZone.instance(afterUTCOffset);
    registerCleanup(() => {
        luxon.Settings.defaultZone = originalZone;
    });

    patchWithCleanup(session, {
        getTZOffset() {
            // BOI not sure when it is used
            return afterUTCOffset;
        },
    });
}
