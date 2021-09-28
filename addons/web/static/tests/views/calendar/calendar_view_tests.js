/** @odoo-module **/

import { viewService } from "@web/views/view_service";
import { actionService } from "@web/webclient/actions/action_service";
import { dialogService } from "@web/core/dialog/dialog_service";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { notificationService } from "@web/core/notifications/notification_service";
import { ormService } from "@web/core/orm_service";
import { popoverService } from "@web/core/popover/popover_service";
import { titleService } from "@web/core/browser/title_service";
import { registry } from "@web/core/registry";
import { userService } from "@web/core/user_service";
import { makeFakeLocalizationService } from "../../helpers/mock_services";
import { click, getFixture, patchDate, patchWithCleanup } from "../../helpers/utils";
import { makeView } from "../helpers";
import { clickEvent } from "./calendar_helpers";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { registerCleanup } from "../../helpers/cleanup";
import { clearRegistryWithCleanup } from "../../helpers/mock_env";
import { browser } from "@web/core/browser/browser";

const serviceRegistry = registry.category("services");
const mainComponentRegistry = registry.category("main_components");

let serverData;
let uid = -1;

QUnit.module("wowl Views", (hooks) => {
    hooks.beforeEach(async () => {
        // 2016-12-12 08:00:00
        patchDate(2016, 11, 12, 8, 0, 0);

        clearRegistryWithCleanup(serviceRegistry);
        clearRegistryWithCleanup(mainComponentRegistry);

        serviceRegistry.add("action", actionService);
        serviceRegistry.add("dialog", dialogService);
        serviceRegistry.add("hotkey", hotkeyService);
        serviceRegistry.add("notification", notificationService);
        serviceRegistry.add("orm", ormService);
        serviceRegistry.add("popover", popoverService);
        serviceRegistry.add("title", titleService);
        serviceRegistry.add("view", viewService);
        serviceRegistry.add("user", {
            ...userService,
            start() {
                const fakeUserService = userService.start(...arguments);
                Object.defineProperty(fakeUserService, "userId", {
                    get: () => uid,
                });
                return fakeUserService;
            },
        });

        serverData = {
            models: {
                event: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        user_id: {
                            string: "user",
                            type: "many2one",
                            relation: "user",
                            default: uid,
                        },
                        partner_id: {
                            string: "user",
                            type: "many2one",
                            relation: "partner",
                            related: "user_id.partner_id",
                            default: 1,
                        },
                        name: { string: "name", type: "char" },
                        start_date: { string: "start date", type: "date" },
                        stop_date: { string: "stop date", type: "date" },
                        start: { string: "start datetime", type: "datetime" },
                        stop: { string: "stop datetime", type: "datetime" },
                        delay: { string: "delay", type: "float" },
                        allday: { string: "allday", type: "boolean" },
                        partner_ids: {
                            string: "attendees",
                            type: "one2many",
                            relation: "partner",
                            default: [[6, 0, [1]]],
                        },
                        type: { string: "type", type: "integer" },
                        event_type_id: {
                            string: "Event Type",
                            type: "many2one",
                            relation: "event_type",
                        },
                        color: { string: "Color", type: "integer", related: "event_type_id.color" },
                        is_hatched: { string: "Hatched", type: "boolean" },
                    },
                    records: [
                        {
                            id: 1,
                            user_id: uid,
                            partner_id: 1,
                            name: "event 1",
                            start: "2016-12-11 00:00:00",
                            stop: "2016-12-11 00:00:00",
                            allday: false,
                            partner_ids: [1, 2, 3],
                            type: 1,
                            is_hatched: false,
                        },
                        {
                            id: 2,
                            user_id: uid,
                            partner_id: 1,
                            name: "event 2",
                            start: "2016-12-12 10:55:05",
                            stop: "2016-12-12 14:55:05",
                            allday: false,
                            partner_ids: [1, 2],
                            type: 3,
                            is_hatched: false,
                        },
                        {
                            id: 3,
                            user_id: 4,
                            partner_id: 4,
                            name: "event 3",
                            start: "2016-12-12 15:55:05",
                            stop: "2016-12-12 16:55:05",
                            allday: false,
                            partner_ids: [1],
                            type: 2,
                            is_hatched: true,
                        },
                        {
                            id: 4,
                            user_id: uid,
                            partner_id: 1,
                            name: "event 4",
                            start: "2016-12-14 15:55:05",
                            stop: "2016-12-14 18:55:05",
                            allday: true,
                            partner_ids: [1],
                            type: 2,
                            is_hatched: false,
                        },
                        {
                            id: 5,
                            user_id: 4,
                            partner_id: 4,
                            name: "event 5",
                            start: "2016-12-13 15:55:05",
                            stop: "2016-12-20 18:55:05",
                            allday: false,
                            partner_ids: [2, 3],
                            type: 2,
                            is_hatched: true,
                        },
                        {
                            id: 6,
                            user_id: uid,
                            partner_id: 1,
                            name: "event 6",
                            start: "2016-12-18 08:00:00",
                            stop: "2016-12-18 09:00:00",
                            allday: false,
                            partner_ids: [3],
                            type: 3,
                            is_hatched: true,
                        },
                        {
                            id: 7,
                            user_id: uid,
                            partner_id: 1,
                            name: "event 7",
                            start: "2016-11-14 08:00:00",
                            stop: "2016-11-16 17:00:00",
                            allday: false,
                            partner_ids: [2],
                            type: 1,
                            is_hatched: false,
                        },
                    ],
                    methods: {
                        async check_access_rights() {
                            return true;
                        },
                    },
                },
                user: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        display_name: { string: "Displayed name", type: "char" },
                        partner_id: { string: "partner", type: "many2one", relation: "partner" },
                        image: { string: "image", type: "integer" },
                    },
                    records: [
                        { id: uid, display_name: "user 1", partner_id: 1 },
                        { id: 4, display_name: "user 4", partner_id: 4 },
                    ],
                },
                partner: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        display_name: { string: "Displayed name", type: "char" },
                        image: { string: "image", type: "integer" },
                    },
                    records: [
                        { id: 1, display_name: "partner 1", image: "AAA" },
                        { id: 2, display_name: "partner 2", image: "BBB" },
                        { id: 3, display_name: "partner 3", image: "CCC" },
                        { id: 4, display_name: "partner 4", image: "DDD" },
                    ],
                },
                event_type: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        display_name: { string: "Displayed name", type: "char" },
                        color: { string: "Color", type: "integer" },
                    },
                    records: [
                        { id: 1, display_name: "Event Type 1", color: 1 },
                        { id: 2, display_name: "Event Type 2", color: 2 },
                        { id: 3, display_name: "Event Type 3 (color 4)", color: 4 },
                    ],
                },
                filter_partner: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        user_id: { string: "user", type: "many2one", relation: "user" },
                        partner_id: { string: "partner", type: "many2one", relation: "partner" },
                        partner_checked: { string: "checked", type: "boolean" },
                    },
                    records: [
                        { id: 1, user_id: uid, partner_id: 1, partner_checked: true },
                        { id: 2, user_id: uid, partner_id: 2, partner_checked: true },
                        { id: 3, user_id: 4, partner_id: 3, partner_checked: true },
                    ],
                },
            },
        };
    });

    QUnit.module("CalendarView");

    QUnit.debug("simple calendar rendering", async (assert) => {
        serverData.models.event.records.push({
            id: 8,
            user_id: uid,
            partner_id: false,
            name: "event 7",
            start: "2016-12-18 09:00:00",
            stop: "2016-12-18 10:00:00",
            allday: false,
            partner_ids: [2],
            type: 1,
        });

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="week"
                    attendee="partner_ids"
                    color="partner_id"
                    event_open_popup="true"
                >
                    <filter name="user_id" avatar_field="image" />
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                    <field name="partner_id" filters="1" invisible="1" />
                </calendar>
            `,
        });

        assert.ok(
            calendar.el.querySelectorAll(".o-calendar-view--calendar .fc-view-container").length,
            "should instance of fullcalendar"
        );

        const sidebar = calendar.el.querySelector(".o-calendar-view--search");

        // test view scales
        assert.containsN(
            calendar.el,
            ".fc-event",
            0,
            "By default, only the events of the current user are displayed (0 in this case)"
        );

        // display all events
        await click(calendar.el, ".o-calendar-filter-panel--filter[data-value='all'] input");
        assert.containsN(
            calendar.el,
            ".fc-event",
            9,
            "should display 9 events on the week (4 event + 5 days event)"
        );
        assert.containsN(
            sidebar,
            "tr:has(.ui-state-active) td",
            7,
            "week scale should highlight 7 days in mini calendar"
        );

        await click(calendar.el, ".o-calendar-view--scale-button--day"); // display only one day
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");
        assert.containsOnce(
            sidebar,
            ".o-selected-range",
            "should highlight the target day in mini calendar"
        );

        await click(calendar.el, ".o-calendar-view--scale-button--month"); // display all the month

        // We display the events or partner 1 2 and 4. Partner 2 has nothing and Event 6 is for partner 6 (not displayed)
        await click(calendar.el, ".o-calendar-filter-panel--filter[data-value='all'] input");
        await click(
            calendar.el.querySelectorAll(".o-calendar-filter-panel--section")[0],
            ".o-calendar-filter-panel--filter[data-value='1'] input"
        );
        await click(calendar.el, ".o-calendar-filter-panel--filter[data-value='2'] input");
        assert.containsN(
            calendar.el,
            ".fc-event",
            7,
            "should display 7 events on the month (5 events + 2 week event - 1 'event 6' is filtered + 1 'Undefined event')"
        );
        assert.containsN(
            sidebar,
            "td a",
            31,
            "month scale should highlight all days in mini calendar"
        );

        // test filters
        assert.containsN(
            sidebar,
            ".o-calendar-filter-panel--section",
            2,
            "should display 2 filters"
        );

        const typeFilter = sidebar.querySelectorAll(".o-calendar-filter-panel--section")[1];

        assert.ok(!!typeFilter, "should display 'user' filter");
        assert.containsN(
            typeFilter,
            ".o-calendar-filter-panel--filter",
            3,
            "should display 3 filter items for 'user'"
        );

        let lastFilter;
        {
            const filters = typeFilter.querySelectorAll(".o-calendar-filter-panel--filter");
            lastFilter = filters[filters.length - 1];
        }
        // filters which has no value should show with string "Undefined", should not have any user image and should show at the last
        assert.notOk(
            lastFilter.hasAttribute("data-value"),
            "filters having false value should be displayed at last in filter items"
        );
        assert.strictEqual(
            lastFilter.querySelector(".o-calendar-filter-panel--filter-title").textContent,
            "Undefined",
            "filters having false value should display 'Undefined' string"
        );
        assert.containsNone(
            lastFilter,
            ".o-calendar-filter-panel--filter-avatar",
            "filters having false value should not have any user image"
        );
        const attendeesFilter = sidebar.querySelectorAll(".o-calendar-filter-panel--section")[0];
        assert.ok(!!attendeesFilter, "should display 'attendees' filter");
        assert.containsN(
            attendeesFilter,
            ".o-calendar-filter-panel--filter",
            3,
            "should display 3 filter items for 'attendees' who use write_model (checkall + 2 saved + Everything)"
        );
        assert.containsOnce(
            attendeesFilter,
            ".o-calendar-filter-panel--section-input",
            "should display one2many search bar for 'attendees' filter"
        );

        assert.containsN(
            calendar.el,
            ".fc-event",
            7,
            "should display 7 events ('event 5' counts for 2 because it spans two weeks and thus generate two fc-event elements)"
        );
        await click(
            calendar.el.querySelectorAll(
                ".o-calendar-filter-panel--section input[type='checkbox']"
            )[1]
        ); // click on partner 2
        assert.containsN(calendar, ".fc-event", 4, "should now only display 4 event");
        await click(
            calendar.el.querySelectorAll(
                ".o-calendar-filter-panel--section input[type='checkbox']"
            )[2]
        );
        assert.containsNone(calendar, ".fc-event", "should not display any event anymore");

        // test search bar in filter
        await click(sidebar.querySelector("input[type='text']"));
        let autoCompleteItems = document.body.querySelectorAll("ul.ui-autocomplete li");
        assert.strictEqual(
            autoCompleteItems.length,
            2,
            "should display 2 choices in one2many autocomplete"
        );
        await click(autoCompleteItems[0]);
        assert.containsN(
            attendeesFilter,
            ".o-calendar-filter-panel--filter",
            4,
            "should display 4 filter items for 'attendees'"
        );

        await click(sidebar.querySelector("input[type='text']"));
        autoCompleteItems = document.body.querySelectorAll("ul.ui-autocomplete li");
        assert.strictEqual(
            autoCompleteItems.length,
            1,
            "should display the last choice in one2many autocomplete"
        );
        assert.strictEqual(
            autoCompleteItems[0].textContent,
            "partner 4",
            "should display the last choice in one2many autocomplete"
        );
        await click(sidebar.querySelectorAll(".o-calendar-filter-panel--filter-remove")[1]);
        assert.containsN(
            attendeesFilter,
            ".o-calendar-filter-panel--filter",
            3,
            "click on remove then should display 3 filter items for 'attendees'"
        );
    });

    QUnit.test(
        "delete attribute on calendar doesn't show delete button in popover",
        async (assert) => {
            const calendar = await makeView({
                type: "wowl_calendar",
                resModel: "event",
                serverData,
                arch: `
                    <calendar
                        date_start="start"
                        date_stop="stop"
                        mode="month"
                        event_open_popup="1"
                        delete="0"
                    />
                `,
            });

            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
            });

            const mainComponentsContainer = await owl.mount(MainComponentsContainer, {
                target: getFixture(),
            });
            registerCleanup(() => {
                mainComponentsContainer.destroy();
            });

            await clickEvent(calendar, 4);
            assert.containsOnce(
                mainComponentsContainer,
                ".o-calendar-common-popover",
                "should open a popover clicking on event"
            );
            assert.containsNone(
                mainComponentsContainer,
                ".o-calendar-common-popover .o_cw_popover_delete",
                "should not have the 'Delete' Button"
            );
        }
    );

    QUnit.todo("breadcrumbs are updated with the displayed period", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create and change events", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("quickcreate with custom create_name_field", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("quickcreate switching to actual create for required fields", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("open multiple event form at the same time", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create event with timezone in week mode European locale", async (assert) => {
        assert.ok(false);
    });

    QUnit.test("default week start (US)", async (assert) => {
        assert.expect(4);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="week"
                />
            `,
            mockRPC(route, { method, model, kwargs }) {
                if (model === "event" && method === "search_read") {
                    // called twice (once for records and once for filters)
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2016-12-17 23:59:59"],
                            ["stop", ">=", "2016-12-11 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Sun 11",
            "The first day of the week should be Sunday"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Sat 17",
            "The last day of the week should be Saturday"
        );
    });

    QUnit.test("European week start", async (assert) => {
        assert.expect(3);

        // the week start depends on the locale
        serviceRegistry.add(
            "localization",
            makeFakeLocalizationService({
                weekStart: 1,
            })
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="week"
                />
            `,
            mockRPC(route, { method, model, kwargs }) {
                if (model === "event" && method === "search_read") {
                    // called twice (once for records and once for filters)
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2016-12-18 23:59:59"],
                            ["stop", ">=", "2016-12-12 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Mon 12",
            "The first day of the week should be Monday"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Sun 18",
            "The last day of the week should be Sunday"
        );
    });

    QUnit.test("week numbering", async (assert) => {
        // week number depends on the week start, which depends on the locale
        // the calendar library uses numbers [0 .. 6], while Odoo uses [1 .. 7]
        // so if the modulo is not done, the week number is incorrect

        serviceRegistry.add(
            "localization",
            makeFakeLocalizationService({
                weekStart: 7,
            })
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="week"
                />
            `,
        });

        assert.strictEqual(
            calendar.el.querySelector(".fc-week-number").textContent,
            // "Week 51", // with moment
            "Week 49" // with luxon
        );
    });

    QUnit.todo("render popover", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("render popover with modifiers", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("render popover with widget which has specialData attribute", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("attributes hide_date and hide_time", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo(
        "create event with timezone in week mode with formViewDialog European locale",
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo("create event with timezone in week mode American locale", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("fetch event when being in timezone", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo(
        "create event with timezone in week mode with formViewDialog American locale",
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo("check calendar week column timeformat", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create all day event in week mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create event with default context (no quickCreate)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create all day event in week mode (no quickCreate)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create event in month mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("use mini calendar", async (assert) => {
        // tz offset = 120

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="week"
                />
            `,
        });

        assert.containsOnce(calendar.el, ".fc-timeGridWeek-view", "should be in week mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            9,
            "should display 9 events on the week (4 event + 5 days event)"
        );

        await click(calendar.el, ".o-calendar-date-picker a:contains(19)");
        // Clicking on a day in another week should switch to the other week view
        assert.containsOnce(calendar.el, ".fc-timeGridWeek-view", "should be in week mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            4,
            "should display 4 events on the week (1 event + 3 days event)"
        );

        // Clicking on a day in the same week should switch to that particular day view
        await click(calendar.el, ".o-calendar-date-picker a:contains(18)");
        assert.containsOnce(calendar.el, ".fc-timeGridDay-view", "should be in day mode");
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");

        // Clicking on the same day should toggle between day, month and week views
        await click(calendar.el, ".o-calendar-date-picker a:contains(18)");
        assert.containsOnce(calendar.el, ".fc-dayGridMonth-view", "should be in month mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            7,
            "should display 7 events on the month (event 5 is on multiple weeks and generates to .fc-event)"
        );

        await click(calendar.el, ".o-calendar-date-picker a:contains(18)");
        assert.containsOnce(calendar.el, ".fc-timeGridWeek-view", "should be in week mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            4,
            "should display 4 events on the week (1 event + 3 days event)"
        );

        await click(calendar.el, ".o-calendar-date-picker a:contains(18)");
        assert.containsOnce(calendar.el, ".fc-timeGridDay-view", "should be in day mode");
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");
    });

    QUnit.todo("rendering, with many2many", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("open form view", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create and edit event in month mode (all_day: false)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("show start time of single day event for month mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("start time should not shown for date type field", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("start time should not shown in month mode if hide_time is true", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("readonly date_start field", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("check filters with filter_field specified", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo('"all" filter', async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("Add filters and specific color", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create event with filters", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create event with filters (no quickCreate)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("Update event with filters", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("change pager with filters", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("ensure events are still shown if filters give an empty domain", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("events starting at midnight", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("set event as all day when field is date", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo(
        "set event as all day when field is date (without all_day mapping)",
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo("quickcreate avoid double event creation", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("check if the view destroys all widgets and instances", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("create an event (async dialog) [REQUIRE FOCUS]", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("calendar is configured to have no groupBy menu", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("timezone does not affect current day", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("timezone does not affect drag and drop", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("timzeone does not affect calendar with date field", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("drag and drop on month mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("drag and drop on month mode with all_day mapping", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("drag and drop on month mode with date_start and date_delay", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("form_view_id attribute works (for creating events)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("form_view_id attribute works with popup (for creating events)", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("calendar fallback to form view id in action if necessary", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("fullcalendar initializes with right locale", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("initial_date given in the context", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("default week start (US) month mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("European week start month mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("Monday week start week mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("Saturday week start week mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo(
        'edit record and attempt to create a record with "create" attribute set to false',
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo(
        'attempt to create record with "create" and "quick_add" attributes set to false',
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo(
        "attempt to create multiples events and the same day and check the ordering on month view",
        async (assert) => {
            assert.ok(false);
        }
    );

    QUnit.todo("drag and drop 24h event on week mode", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("correctly display year view", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("toggle filters in year view", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("allowed scales", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("click outside the popup should close it", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("calendar: disableQuickCreate in data event", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("fields are added in the right order in popover", async (assert) => {
        assert.ok(false);
    });

    QUnit.todo("select events and discard create", async (assert) => {
        assert.ok(false);
    });
});
