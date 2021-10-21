/** @odoo-module **/

import { viewService } from "@web/views/view_service";
import { actionService } from "@web/webclient/actions/action_service";
import { dialogService } from "@web/core/dialog/dialog_service";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { notificationService } from "@web/core/notifications/notification_service";
import { ormService } from "@web/core/orm_service";
import { popoverService } from "@web/core/popover/popover_service";
import { registry } from "@web/core/registry";
import { userService } from "@web/core/user_service";
import { mocks } from "../../helpers/mock_services";
import {
    click,
    getFixture,
    patchDate,
    patchWithCleanup,
    triggerEvent,
    makeDeferred,
    nextTick,
    legacyExtraNextTick,
} from "../../helpers/utils";
import { makeView } from "../helpers";
import {
    changeScale,
    clickDate,
    clickEvent,
    findEvent,
    findFilterPanelFilter,
    findFilterPanelSection,
    findPickedDate,
    findTimeRow,
    moveEventToAllDaySlot,
    moveEventToDate,
    moveEventToTime,
    navigate,
    patchTimeZone,
    pickDate,
    selectAllDayRange,
    selectDateRange,
    selectTimeRange,
    toggleFilter,
    toggleSectionFilter,
} from "./calendar_helpers";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { registerCleanup } from "../../helpers/cleanup";
import { clearRegistryWithCleanup } from "../../helpers/mock_env";
import { browser } from "@web/core/browser/browser";

// These are legacy modules and should be removed
import AbstractField from "web.AbstractField";
import fieldRegistry from "web.field_registry";
import { FormViewDialog } from "web.view_dialogs";
import BasicModel from "web.BasicModel";

const serviceRegistry = registry.category("services");
const mainComponentRegistry = registry.category("main_components");

let serverData;
let uid = -1;

async function addMainComponentsContainer(env) {
    const mainComponentsContainer = await owl.mount(MainComponentsContainer, {
        target: getFixture(),
        env,
    });
    registerCleanup(() => {
        mainComponentsContainer.destroy();
    });

    return mainComponentsContainer.el;
}

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
        serviceRegistry.add("title", mocks.title());
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
            views: {
                "event,false,form": `
                    <form>
                        <field name="name" />
                        <field name="allday" />
                        <group attrs="{'invisible': [['allday', '=', True]]}">
                            <field name="start" />
                            <field name="stop" />
                        </group>
                        <group attrs="{'invisible': [['allday', '=', False]]}">
                            <field name="start_date" />
                            <field name="stop_date" />
                        </group>
                    </form>
                `,
                "event,1,form": `
                    <form>
                        <field name="allday" invisible="1" />
                        <field name="start" attrs="{'invisible': [['allday', '=', False]]}" />
                        <field name="stop" attrs="{'invisible': [['allday', '=', True]]}" />
                    </form>
                `,
            },
        };
    });

    QUnit.module("CalendarView");

    QUnit.test("simple calendar rendering", async (assert) => {
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

        await changeScale(calendar, "day"); // display only one day
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");
        assert.containsOnce(
            sidebar,
            ".o-selected-range",
            "should highlight the target day in mini calendar"
        );

        await changeScale(calendar, "month"); // display all the month

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
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
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
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
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
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
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
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
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

            const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
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

    QUnit.test("breadcrumbs are updated with the displayed period", async (assert) => {
        let currentTitles = {};
        const fakeTitleService = {
            start() {
                return {
                    get current() {
                        return JSON.stringify(currentTitles);
                    },
                    getParts() {
                        return currentTitles;
                    },
                    setParts(parts) {
                        currentTitles = Object.assign({}, currentTitles, parts);
                    },
                };
            },
        };
        serviceRegistry.add("title", fakeTitleService, { force: true });
        currentTitles.action = "Meetings Test";

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                />
            `,
        });

        // displays week mode by default
        assert.strictEqual(
            calendar.el.querySelector(".o_control_panel .breadcrumb-item.active").textContent,
            "Meetings Test (Dec 11 – 17, 2016)",
            "should display the current week"
        );

        // switch to day mode
        await changeScale(calendar, "day");
        assert.strictEqual(
            calendar.el.querySelector(".o_control_panel .breadcrumb-item.active").textContent,
            "Meetings Test (December 12, 2016)",
            "should display the current day"
        );

        // switch to month mode
        await changeScale(calendar, "month");
        assert.strictEqual(
            calendar.el.querySelector(".o_control_panel .breadcrumb-item.active").textContent,
            "Meetings Test (December 2016)",
            "should display the current month"
        );

        // switch to year mode
        await changeScale(calendar, "year");
        assert.strictEqual(
            calendar.el.querySelector(".o_control_panel .breadcrumb-item.active").textContent,
            "Meetings Test (2016)",
            "should display the current year"
        );
    });

    QUnit.test("create and change events", async (assert) => {
        assert.expect(28);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                    event_open_popup="1"
                />
            `,
            mockRPC(route, { args, method }) {
                if (method === "write") {
                    assert.deepEqual(
                        args[1],
                        { name: "event 4 modified" },
                        "should update the record"
                    );
                }
            },
        });
        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        assert.containsOnce(calendar.el, ".fc-dayGridMonth-view", "should display in month mode");

        // click on an existing event to open the formViewDialog
        await clickEvent(calendar, 4);

        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover",
            "should open a popover clicking on event"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover .o_cw_popover_close",
            "popover should have a close button"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover .o_cw_popover_edit",
            "popover should have an edit button"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover .o_cw_popover_delete",
            "popover should have a delete button"
        );

        await click(mainComponentsContainer, ".o-calendar-common-popover .o_cw_popover_edit");
        assert.containsOnce(
            mainComponentsContainer,
            ".modal-body",
            "should open the form view in dialog when click on event"
        );

        let input = mainComponentsContainer.querySelector(".modal-body input");
        input.value = "event 4 modified";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".modal-footer button.btn-primary");
        assert.containsNone(mainComponentsContainer, ".modal-body");

        // create a new event, quick create only
        await clickDate(calendar, "2016-12-13");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the quick create dialog"
        );

        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
        assert.strictEqual(
            findEvent(calendar, 8).textContent,
            "new event in quick create",
            "should display the new record after quick create"
        );
        assert.containsN(
            calendar.el,
            "td.fc-event-container[colspan]",
            2,
            "should the new record have only one day"
        );

        // create a new event, quick create only (validated by pressing enter key)
        await clickDate(calendar, "2016-12-13");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the quick create dialog"
        );

        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create validated by pressing enter key.";
        await triggerEvent(input, null, "input");

        await triggerEvent(input, null, "keyup", { key: "Enter" });
        assert.strictEqual(
            findEvent(calendar, 9).textContent,
            "new event in quick create validated by pressing enter key.",
            "should display the new record by pressing enter key"
        );

        // create a new event and edit it
        await clickDate(calendar, "2016-12-27");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the quick create dialog"
        );

        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
        assert.containsOnce(
            mainComponentsContainer,
            ".modal",
            "should open the slow create dialog"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(".modal .modal-title").textContent,
            "New Event",
            "should use the string attribute as modal title"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.modal input[name="name"]`).value,
            "coucou",
            "should have set the name from the quick create dialog"
        );

        await click(mainComponentsContainer.querySelector(".modal-footer button.btn-primary"));
        assert.strictEqual(
            findEvent(calendar, 10).textContent,
            "coucou",
            "should display the new record with string attribute"
        );

        // create a new event with 2 days
        await selectDateRange(calendar, "2016-12-20", "2016-12-21");

        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create 2";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.modal .o_form_view input[name="name"]`).value,
            "new event in quick create 2",
            "should open the formViewDialog with default values"
        );

        await click(mainComponentsContainer.querySelector(".modal-footer button.btn-primary"));
        assert.containsNone(mainComponentsContainer, ".modal", "should close dialogs");

        const newEvent = findEvent(calendar, 11);
        assert.strictEqual(
            newEvent.textContent,
            "new event in quick create 2",
            "should display the 2 days new record"
        );
        assert.hasAttrValue(
            newEvent.closest(".fc-event-container"),
            "colspan",
            "2",
            "the new record should have 2 days"
        );

        await clickEvent(calendar, 11);
        const popoverDescription = mainComponentsContainer.querySelector(
            ".o-calendar-common-popover .list-group-item"
        );
        assert.strictEqual(
            popoverDescription.children[1].textContent,
            "December 20-21, 2016",
            "The popover description should indicate the correct range"
        );
        assert.strictEqual(
            popoverDescription.children[2].textContent,
            "(2 days)",
            "The popover description should indicate 2 days"
        );
        await click(mainComponentsContainer, ".o_cw_popover_close");

        // delete the a record
        await clickEvent(calendar, 4);
        await click(mainComponentsContainer, ".o_cw_popover_delete");
        assert.strictEqual(
            mainComponentsContainer.querySelector(".modal-title").textContent,
            "Confirmation",
            "should display the confirm message"
        );

        await click(mainComponentsContainer, ".modal-footer button.btn-primary");

        assert.notOk(findEvent(calendar, 4), "the record should be deleted");

        assert.containsN(
            calendar.el,
            ".fc-event-container .fc-event",
            10,
            "should display 10 events"
        );
        // move to next month
        await navigate(calendar, "next");
        assert.containsNone(
            calendar.el,
            ".fc-event-container .fc-event",
            "should display 0 events"
        );

        await navigate(calendar, "previous");

        await selectDateRange(calendar, "2016-12-20", "2016-12-21");
        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "test";
        await triggerEvent(input, null, "input");
        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
    });

    QUnit.test("quickcreate with custom create_name_field", async (assert) => {
        assert.expect(4);

        serverData.models["custom.event"] = {
            fields: {
                id: { string: "ID", type: "integer" },
                x_name: { string: "name", type: "char" },
                x_start_date: { string: "start date", type: "date" },
            },
            records: [{ id: 1, x_name: "some event", x_start_date: "2016-12-06" }],
            methods: {
                async check_access_rights() {
                    return true;
                },
            },
        };

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "custom.event",
            serverData,
            arch: `
                <calendar
                    date_start="x_start_date"
                    create_name_field="x_name"
                    mode="month"
                />
            `,
            mockRPC(route, { args, method }) {
                if (method === "create") {
                    assert.deepEqual(
                        args[0],
                        {
                            x_name: "custom event in quick create",
                            x_start_date: "2016-12-13 00:00:00",
                        },
                        "the custom create_name_field should be used instead of `name`"
                    );
                }
            },
        });
        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        await clickDate(calendar, "2016-12-13");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the quick create dialog"
        );

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "custom event in quick create";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
        assert.containsOnce(
            calendar.el,
            `.fc-event[data-event-id="2"]`,
            "should display the new custom event record"
        );
        assert.strictEqual(
            calendar.el.querySelector(`.fc-event[data-event-id="2"]`).textContent,
            "custom event in quick create"
        );
    });

    QUnit.test("quickcreate switching to actual create for required fields", async (assert) => {
        assert.expect(4);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                    event_open_popup="1"
                />
            `,
            mockRPC(route, { method }) {
                if (method === "create") {
                    return Promise.reject({
                        message: {
                            code: 200,
                            data: {},
                            message: "Odoo server error",
                        },
                        event: new Event("server_error"),
                    });
                }
            },
        });
        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // create a new event
        await clickDate(calendar, "2016-12-13");
        assert.strictEqual(
            mainComponentsContainer.querySelector(".modal-title").textContent,
            "New Event",
            "should open the quick create dialog"
        );

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "custom event in quick create";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        assert.containsNone(mainComponentsContainer, ".o-calendar-quick-create");
        assert.strictEqual(
            mainComponentsContainer.querySelector(".modal-title").textContent,
            "New Event",
            "should have switched to a bigger modal for an actual create rather than quickcreate"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".modal .o_form_view.o_form_editable",
            "should open the full event form view in a dialog"
        );
    });

    QUnit.test("open multiple event form at the same time", async (assert) => {
        assert.expect(2);

        const def = makeDeferred();
        let counter = 0;

        patchWithCleanup(FormViewDialog.prototype, {
            open() {
                counter++;
                delete this.options.fields_view;
                return this._super(...arguments);
            },
            async loadFieldView() {
                const _super = this._super;
                await def;
                return _super(...arguments);
            },
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
                    mode="month"
                    event_open_popup="1"
                    quick_add="0"
                >
                    <field name="name" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        for (let i = 0; i < 5; i++) {
            await clickDate(calendar, "2016-12-13");
        }

        def.resolve();
        await nextTick();

        assert.equal(counter, 5, "there should had been 5 attemps to open a modal");
        assert.containsOnce(
            mainComponentsContainer,
            ".modal",
            "there should be only one open modal"
        );
    });

    QUnit.test("create event with timezone in week mode European locale", async (assert) => {
        assert.expect(4);
        serverData.models.event.records = [];
        patchTimeZone(120);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
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
                    event_open_popup="1"
                >
                    <field name="name" />
                    <field name="start" />
                    <field name="allday" />
                </calendar>
            `,
            mockRPC(route, { method, args }) {
                if (method === "create") {
                    assert.deepEqual(
                        args,
                        [
                            {
                                allday: false,
                                name: "new event",
                                start: "2016-12-13 06:00:00",
                                stop: "2016-12-13 08:00:00",
                            },
                        ],
                        "should create this event"
                    );
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        await selectTimeRange(calendar, "2016-12-13 08:00:00", "2016-12-13 10:00:00");
        assert.strictEqual(
            calendar.el.querySelector(".fc-content .fc-time").textContent,
            "8:00 - 10:00",
            "should display the time in the calendar sticker"
        );

        let input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        assert.strictEqual(
            calendar.el.querySelector(".fc-event .o_event_title").textContent,
            "new event",
            "should display the new event with title"
        );

        // delete record
        await clickEvent(calendar, 1);
        await legacyExtraNextTick();
        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_delete");
        await click(mainComponentsContainer, ".modal button.btn-primary");
        assert.containsNone(calendar, ".fc-content", "should delete the record");
    });

    QUnit.test("default week start (US)", async (assert) => {
        assert.expect(3);

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
            mocks.localization({
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
            mocks.localization({
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

    QUnit.test("render popover", async (assert) => {
        assert.expect(14);

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
                >
                    <field name="name" string="Custom Name" />
                    <field name="partner_id" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickEvent(calendar, 4);

        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(".o_cw_popover .popover-header").textContent,
            "event 4",
            "popover should have a title 'event 4'"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover .o_cw_popover_edit",
            "popover should have an edit button"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover .o_cw_popover_delete",
            "popover should have a delete button"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover .o_cw_popover_close",
            "popover should have a close button"
        );

        assert.strictEqual(
            mainComponentsContainer.querySelector(
                ".o_cw_popover .list-group-item b.text-capitalize"
            ).textContent,
            "Wednesday, December 14, 2016",
            "should display date 'Wednesday, December 14, 2016'"
        );
        assert.containsN(
            mainComponentsContainer,
            ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item",
            2,
            "popover should have a two fields"
        );

        const groups = mainComponentsContainer.querySelectorAll(
            ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item"
        );
        assert.containsOnce(groups[0], ".o_field_char", "should apply char widget");
        assert.strictEqual(
            groups[0].querySelector("strong").textContent,
            "Custom Name : ",
            "label should be a 'Custom Name'"
        );
        assert.strictEqual(
            groups[0].querySelector(".o_field_char").textContent,
            "event 4",
            "value should be a 'event 4'"
        );

        assert.containsOnce(groups[1], ".o_form_uri", "should apply m20 widget");
        assert.strictEqual(
            groups[1].querySelector("strong").textContent,
            "user : ",
            "label should be a 'user'"
        );
        assert.strictEqual(
            groups[1].querySelector(".o_form_uri").textContent,
            "partner 1",
            "value should be a 'partner 1'"
        );

        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_close");
        assert.containsNone(mainComponentsContainer, ".o_cw_popover", "should close a popover");
    });

    QUnit.test("render popover with modifiers", async (assert) => {
        assert.expect(5);

        serverData.models.event.fields.priority = {
            string: "Priority",
            type: "selection",
            selection: [
                ["0", "Normal"],
                ["1", "Important"],
            ],
        };

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
                >
                    <field name="priority" widget="priority" readonly="1" />
                    <field name="is_hatched" invisible="1" />
                    <field name="partner_id" attrs="{'invisible': [['is_hatched', '=', False]]}" />
                    <field name="start" attrs="{'invisible': [['is_hatched', '=', True]]}" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickEvent(calendar, 4);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );

        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover .o_priority span.o_priority_star",
            "priority field should not be editable"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(".o_cw_popover li.o_invisible_modifier")
                .textContent,
            "user : partner 1",
            "partner_id field should be invisible"
        );
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover span.o_field_date",
            "The start date should be visible"
        );
        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_close");
        assert.containsNone(mainComponentsContainer, ".o_cw_popover", "should close a popover");
    });

    QUnit.test("render popover with widget which has specialData attribute", async (assert) => {
        assert.expect(3);

        patchWithCleanup(BasicModel.prototype, {
            async _fetchSpecialDataForMyWidget() {
                assert.step("_fetchSpecialDataForMyWidget");
            },
        });
        const MyWidget = AbstractField.extend({
            specialData: "_fetchSpecialDataForMyWidget",
        });
        fieldRegistry.add("specialWidget", MyWidget);
        registerCleanup(() => {
            delete fieldRegistry.map.specialWidget;
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
                >
                    <field name="name" string="Custom Name" widget="specialWidget" />
                    <field name="partner_id" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickEvent(calendar, 4);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.verifySteps(["_fetchSpecialDataForMyWidget"]);
    });

    QUnit.test("attributes hide_date and hide_time", async (assert) => {
        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    hide_date="true"
                    hide_time="true"
                    mode="month"
                />
            `,
        });

        await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickEvent(calendar, 4);
        assert.containsNone(
            calendar.el,
            ".o-calendar-common-popover .list-group-item",
            "popover should not contain date/time"
        );
    });

    QUnit.skip(
        "create event with timezone in week mode with formViewDialog European locale",
        async (assert) => {
            assert.expect(8);

            patchTimeZone(120);
            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
            });
            // translateParameters: { // Avoid issues due to localization formats
            //     time_format: "%H:%M:%S",
            // },

            serverData.models.event.records = [];
            serverData.models.event.onchanges = {
                allday(obj) {
                    if (obj.allday) {
                        obj.start_date = (obj.start && obj.start.split(" ")[0]) || obj.start_date;
                        obj.stop_date =
                            (obj.stop && obj.stop.split(" ")[0]) || obj.stop_date || obj.start_date;
                    } else {
                        obj.start = (obj.start_date && obj.start_date + " 00:00:00") || obj.start;
                        obj.stop =
                            (obj.stop_date && obj.stop_date + " 00:00:00") || obj.stop || obj.start;
                    }
                },
            };

            let expectedEvent = null;

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
                        event_open_popup="1"
                    >
                        <field name="name" />
                    </calendar>
                `,
                mockRPC(route, { args, kwargs, method }) {
                    if (method === "create") {
                        assert.deepEqual(
                            kwargs.context,
                            {
                                default_name: "new event",
                                default_start: "2016-12-13 06:00:00",
                                default_stop: "2016-12-13 08:00:00",
                                default_allday: null,
                            },
                            "should send the context to create events"
                        );
                    } else if (method === "write") {
                        assert.deepEqual(args[1], expectedEvent, "should move the event");
                    }
                },
            });

            const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

            await selectTimeRange(calendar, "2016-12-13 08:00:00", "2016-12-13 10:00:00");

            // Name the new event and edit in formViewDialog
            let input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
            input.value = "new event";
            await triggerEvent(input, null, "input");

            await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");

            // Check the datetimes
            input = mainComponentsContainer.querySelector(".o_field_widget[name='start'] input");
            assert.strictEqual(input.value, "12/13/2016 08:00:00", "should display the datetime");

            // Set allday to true in formViewDialog
            await click(mainComponentsContainer, ".modal .o_field_boolean[name='allday'] input");
            input = mainComponentsContainer.querySelector(
                ".o_field_widget[name='start_date'] input"
            );
            assert.strictEqual(input.value, "12/13/2016", "should display the date");

            // Set allday to false in formViewDialog
            await click(mainComponentsContainer, ".modal .o_field_boolean[name='allday'] input");
            input = mainComponentsContainer.querySelector(".o_field_widget[name='start'] input");
            assert.strictEqual(
                input.value,
                "12/13/2016 02:00:00", // FIXME ? this is weird
                "should display the datetime from the date with the timezone"
            );

            // use datepicker to enter a date: 12/13/2016 08:00:00
            await click(
                mainComponentsContainer,
                `.o_field_widget[name="start"].o_datepicker .o_datepicker_input`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`
            );
            await click(
                document.body.querySelectorAll(
                    `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
                )[8]
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
            );

            // use datepicker to enter a date: 12/13/2016 10:00:00
            await click(
                mainComponentsContainer,
                `.o_field_widget[name="stop"].o_datepicker .o_datepicker_input`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`
            );
            await click(
                document.body.querySelectorAll(
                    `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
                )[10]
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
            );

            await click(mainComponentsContainer, ".modal-footer button.btn-primary");
            assert.strictEqual(
                findEvent(calendar, 1).querySelector(".o_event_title").textContent,
                "new event",
                "should display the new event with title"
            );

            // assert.deepEqual(
            //     serverData.models.event.records[0],
            //     {
            //         display_name: "new event",
            //         start: "2016-12-13 06:00:00",
            //         stop: "2016-12-13 08:00:00",
            //         allday: false,
            //         name: "new event",
            //         id: 1,
            //     },
            //     "the new record should have the utc datetime (formViewDialog)"
            // );

            // Mode this event to another day
            expectedEvent = {
                allday: false,
                start: "2016-12-12 06:00:00",
                stop: "2016-12-12 08:00:00",
            };
            await moveEventToTime(calendar, 1, "2016-12-12 08:00:00");

            // Move to "All day"
            expectedEvent = {
                allday: true,
                start: "2016-12-12 00:00:00",
                stop: "2016-12-12 00:00:00",
            };
            await moveEventToAllDaySlot(calendar, 1, "2016-12-12");
        }
    );

    QUnit.skip("create event with timezone in week mode American locale", async (assert) => {
        assert.expect(5);

        patchTimeZone(120);
        // translateParameters: { // Avoid issues due to localization formats
        //     time_format: "%I:%M:%S",
        // },

        serverData.models.event.records = [];

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    event_open_popup="1"
                >
                    <field name="name" />
                    <field name="start" />
                    <field name="allday" />
                </calendar>
            `,
            mockRPC(route, { kwargs, method }) {
                if (method === "create") {
                    assert.deepEqual(
                        kwargs.context,
                        {
                            default_start: "2016-12-13 06:00:00",
                            default_stop: "2016-12-13 08:00:00",
                            default_allday: null,
                        },
                        "should send the context to create events"
                    );
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await selectTimeRange(calendar, "2016-12-13 06:00:00", "2016-12-13 08:00:00");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        assert.strictEqual(
            findEvent(calendar, 1).querySelector(".o_event_title").textContent,
            "new event",
            "should display the new event with title"
        );

        // assert.deepEqual($newevent[0].fcSeg.eventRange.def.extendedProps.record,
        //     {
        //         display_name: "new event",
        //         start: fieldUtils.parse.datetime("2016-12-13 06:00:00", this.data.event.fields.start, {isUTC: true}),
        //         stop: fieldUtils.parse.datetime("2016-12-13 08:00:00", this.data.event.fields.stop, {isUTC: true}),
        //         allday: false,
        //         name: "new event",
        //         id: 1
        //     },
        //     "the new record should have the utc datetime (quickCreate)");

        // delete record
        await clickEvent(calendar, 1);
        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_delete");
        await click(mainComponentsContainer, ".modal button.btn-primary");
        assert.containsNone(calendar.el, ".fc-content", "should delete the record");
    });

    QUnit.skip("fetch event when being in timezone", async (assert) => {
        assert.expect(3);

        patchTimeZone(660);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="week"
                >
                    <field name="name" />
                    <field name="start" />
                    <field name="allday" />
                </calendar>
            `,
            mockRPC(route, { kwargs, method, model }) {
                if (method === "search_read" && model === "event") {
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2016-12-17 12:59:59"], // in UTC. which is 2016-12-17 23:59:59 in TZ Sydney 11 hours later
                            ["stop", ">=", "2016-12-10 13:00:00"], // in UTC. which is 2016-12-11 00:00:00 in TZ Sydney 11 hours later
                        ],
                        "The domain should contain the right range"
                    );
                }
            },
        });

        const headers = calendar.el.querySelectorAll(".fc-day-header");

        assert.strictEqual(
            headers[0].textContent,
            "Sun 11",
            "The calendar start date should be 2016-12-11"
        );
        assert.strictEqual(
            headers[headers.length - 1].textContent,
            "Sat 17",
            "The calendar start date should be 2016-12-17"
        );
    });

    QUnit.skip(
        "create event with timezone in week mode with formViewDialog American locale",
        async (assert) => {
            assert.expect(8);

            patchTimeZone(120);
            //     translateParameters: { // Avoid issues due to localization formats
            //         time_format: "%I:%M:%S",
            //     },

            serverData.models.event.records = [];
            serverData.models.event.onchanges = {
                allday(obj) {
                    if (obj.allday) {
                        obj.start_date = (obj.start && obj.start.split(" ")[0]) || obj.start_date;
                        obj.stop_date =
                            (obj.stop && obj.stop.split(" ")[0]) || obj.stop_date || obj.start_date;
                    } else {
                        obj.start = (obj.start_date && obj.start_date + " 00:00:00") || obj.start;
                        obj.stop =
                            (obj.stop_date && obj.stop_date + " 00:00:00") || obj.stop || obj.start;
                    }
                },
            };

            let expectedEvent = null;

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
                        event_open_popup="1"
                    >
                        <field name="name" />
                    </calendar>
                `,
                mockRPC(route, { args, kwargs, method }) {
                    if (method === "create") {
                        assert.deepEqual(
                            kwargs.context,
                            {
                                default_name: "new event",
                                default_start: "2016-12-13 06:00:00",
                                default_stop: "2016-12-13 08:00:00",
                                default_allday: null,
                            },
                            "should send the context to create events"
                        );
                    } else if (method === "write") {
                        assert.deepEqual(args[1], expectedEvent, "should move the event");
                    }
                },
            });

            const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
            });

            await selectTimeRange(calendar, "2016-12-13 08:00:00", "2016-12-13 10:00:00");

            const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
            input.value = "new event";
            await triggerEvent(input, null, "input");

            await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
            assert.strictEqual(
                mainComponentsContainer.querySelector(`.o_field_widget[name="start"] input`).value,
                "12/13/2016 08:00:00",
                "should display the datetime"
            );

            await click(mainComponentsContainer, `.modal .o_field_boolean[name="allday"] input`);
            assert.strictEqual(
                mainComponentsContainer.querySelector(`.o_field_widget[name="start"] input`).value,
                "12/13/2016",
                "should display the date"
            );

            await click(mainComponentsContainer, `.modal .o_field_boolean[name="allday"] input`);
            assert.strictEqual(
                mainComponentsContainer.querySelector(`.o_field_widget[name="start"] input`).value,
                "12/13/2016 02:00:00",
                "should display the datetime from the date with the timezone"
            );

            // // use datepicker to enter a date: 12/13/2016 08:00:00
            await click(
                mainComponentsContainer,
                `.o_field_widget[name="start"].o_datepicker .o_datepicker_input`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`
            );
            await click(
                document.body.querySelectorAll(
                    `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
                )[8]
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
            );

            // // use datepicker to enter a date: 12/13/2016 10:00:00
            await click(
                mainComponentsContainer,
                `.o_field_widget[name="stop"].o_datepicker .o_datepicker_input`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`
            );
            await click(
                document.body.querySelectorAll(
                    `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
                )[10]
            );
            await click(
                document.body,
                `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
            );

            await click(mainComponentsContainer, ".modal-footer button.btn-primary");
            assert.strictEqual(
                findEvent(calendar, 1).querySelector(".o_event_title").textContent,
                "new event",
                "should display the new event with title"
            );

            // assert.deepEqual($newevent[0].fcSeg.eventRange.def.extendedProps.record,
            //     {
            //         display_name: "new event",
            //         start: fieldUtils.parse.datetime("2016-12-13 06:00:00", this.data.event.fields.start, {isUTC: true}),
            //         stop: fieldUtils.parse.datetime("2016-12-13 08:00:00", this.data.event.fields.stop, {isUTC: true}),
            //         allday: false,
            //         name: "new event",
            //         id: 1
            //     },
            //     "the new record should have the utc datetime (formViewDialog)");

            // Mode this event to another day
            expectedEvent = {
                allday: false,
                start: "2016-12-12 06:00:00",
                stop: "2016-12-12 08:00:00",
            };
            await moveEventToTime(calendar, 1, "2016-12-12 08:00:00");

            // Move to "All day"
            expectedEvent = {
                allday: true,
                start: "2016-12-12 00:00:00",
                stop: "2016-12-12 00:00:00",
            };
            await moveEventToAllDaySlot(calendar, 1, "2016-12-12");
        }
    );

    QUnit.test("check calendar week column timeformat", async (assert) => {
        serviceRegistry.add(
            "localization",
            mocks.localization({
                timeFormat: "%I:%M:%S",
            })
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar date_start="start" />
            `,
        });

        assert.strictEqual(
            findTimeRow(calendar, "08:00:00").textContent,
            "8am",
            "calendar should show according to timeformat"
        );
        assert.strictEqual(
            findTimeRow(calendar, "23:00:00").textContent,
            "11pm",
            "event time format should 12 hour"
        );
    });

    QUnit.skip("create all day event in week mode", async (assert) => {
        assert.expect(3);

        patchTimeZone(120);

        serverData.models.event.records = [];

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    event_open_popup="1"
                >
                    <field name="name" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await selectAllDayRange(calendar, "2016-12-14", "2016-12-15");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        const event = findEvent(calendar, 1);
        assert.strictEqual(
            event.textContent.replace(/[\s\n\r]+/g, ""),
            "newevent",
            "should display the new event with time and title"
        );
        assert.hasAttrValue(event.parentElement, "colspan", "2", "should appear over two days.");

        // assert.deepEqual($newevent[0].fcSeg.eventRange.def.extendedProps.record,
        //     {
        //         display_name: "new event",
        //         start: fieldUtils.parse.datetime("2016-12-14 00:00:00", this.data.event.fields.start, {isUTC: true}),
        //         stop: fieldUtils.parse.datetime("2016-12-15 00:00:00", this.data.event.fields.stop, {isUTC: true}),
        //         allday: true,
        //         name: "new event",
        //         id: 1
        //     },
        //     "the new record should have the utc datetime (quickCreate)");
    });

    QUnit.skip("create event with default context (no quickCreate)", async (assert) => {
        assert.expect(3);

        patchTimeZone(120);

        serverData.models.event.records = [];

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="week"
                    all_day="allday"
                    quick_add="0"
                />
            `,
        });

        // const calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     `<calendar
        //         class="o_calendar_test"
        //         date_start="start"
        //         date_stop="stop"
        //         mode="week"
        //         all_day="allday"
        //         quick_add="False"/>`,
        //     archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset() {
        //             return 120;
        //         },
        //     },
        //     context: {
        //         default_name: 'New',
        //     },
        //     intercepts: {
        //         do_action(ev) {
        //             assert.step('do_action');
        //             assert.deepEqual(ev.data.action.context, {
        //                 default_name: "New",
        //                 default_start: "2016-12-14 00:00:00",
        //                 default_stop: "2016-12-15 00:00:00",
        //                 default_allday: true,
        //             },
        //             "should send the correct data to create events");
        //         },
        //     },
        // }, { positionalClicks: true });

        await selectAllDayRange(calendar, "2016-12-14", "2016-12-15");
        assert.verifySteps(["do_action"]);
    });

    QUnit.skip("create all day event in week mode (no quickCreate)", async (assert) => {
        assert.expect(1);

        patchTimeZone(120);

        serverData.models.event.records = [];

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
                    quick_add="0"
                />
            `,
        });

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'mode="week" '+
        //         'all_day="allday" '+
        //         'quick_add="False"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return 120;
        //         },
        //     },
        //     intercepts: {
        //         do_action: function (event) {
        //             assert.deepEqual(event.data.action.context, {
        //                     default_start: "2016-12-14 00:00:00",
        //                     default_stop: "2016-12-15 00:00:00",
        //                     default_allday: true,
        //             },
        //             "should send the correct data to create events");
        //         },
        //     },
        // }, {positionalClicks: true});

        await selectAllDayRange(calendar, "2016-12-14", "2016-12-15");
    });

    QUnit.skip("create event in month mode", async (assert) => {
        assert.expect(4);

        patchTimeZone(120);

        serverData.models.event.records = [];

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
                >
                    <field name="name" />
                </calendar>
            `,
            mockRPC(route, { args, method }) {
                if (method === "create") {
                    assert.deepEqual(
                        args[0],
                        {
                            name: "new event",
                            start: "2016-12-14 05:00:00",
                            stop: "2016-12-15 17:00:00",
                        },
                        "should send the correct data to create events"
                    );
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await selectDateRange(calendar, "2016-12-14", "2016-12-15");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        const event = findEvent(calendar, 1);
        assert.strictEqual(
            event.textContent.replace(/[\s\n\r]+/g, ""),
            "newevent",
            "should display the new event with time and title"
        );
        assert.hasAttrValue(event.parentElement, "colspan", "2", "should appear over two days.");

        // assert.deepEqual($newevent[0].fcSeg.eventRange.def.extendedProps.record, {
        //     display_name: "new event",
        //     start: fieldUtils.parse.datetime("2016-12-14 05:00:00", this.data.event.fields.start, {isUTC: true}),
        //     stop: fieldUtils.parse.datetime("2016-12-15 17:00:00", this.data.event.fields.stop, {isUTC: true}),
        //     name: "new event",
        //     id: 1
        // }, "the new record should have the utc datetime (quickCreate)");
    });

    QUnit.test("use mini calendar", async (assert) => {
        assert.expect(12);
        patchTimeZone(120);

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

        await pickDate(calendar, "2016-12-19");
        // Clicking on a day in another week should switch to the other week view
        assert.containsOnce(calendar.el, ".fc-timeGridWeek-view", "should be in week mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            4,
            "should display 4 events on the week (1 event + 3 days event)"
        );

        // Clicking on a day in the same week should switch to that particular day view
        await pickDate(calendar, "2016-12-18");
        assert.containsOnce(calendar.el, ".fc-timeGridDay-view", "should be in day mode");
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");

        // Clicking on the same day should toggle between day, month and week views
        await pickDate(calendar, "2016-12-18");
        assert.containsOnce(calendar.el, ".fc-dayGridMonth-view", "should be in month mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            7,
            "should display 7 events on the month (event 5 is on multiple weeks and generates to .fc-event)"
        );

        await pickDate(calendar, "2016-12-18");
        assert.containsOnce(calendar.el, ".fc-timeGridWeek-view", "should be in week mode");
        assert.containsN(
            calendar.el,
            ".fc-event",
            4,
            "should display 4 events on the week (1 event + 3 days event)"
        );

        await pickDate(calendar, "2016-12-18");
        assert.containsOnce(calendar.el, ".fc-timeGridDay-view", "should be in day mode");
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events on the day");
    });

    QUnit.test("rendering, with many2many", async (assert) => {
        assert.expect(5);

        serverData.models.event.fields.partner_ids.type = "many2many";
        serverData.models.event.records[0].partner_ids = [1, 2, 3, 4, 5];
        serverData.models.partner.records.push({ id: 5, display_name: "partner 5", image: "EEE" });

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    event_open_popup="1"
                >
                    <field
                        name="partner_ids"
                        widget="many2many_tags_avatar"
                        avatar_field="image"
                        write_model="filter_partner"
                        write_field="partner_id"
                    />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter .o-calendar-filter-panel--filter-avatar",
            3,
            "should have 3 avatars in the side bar"
        );

        await toggleFilter(calendar, "partner_ids", "all");

        await clickEvent(calendar, 4);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.containsOnce(mainComponentsContainer, ".o_cw_popover img", "should have 1 avatar");

        await clickEvent(calendar, 1);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.containsN(mainComponentsContainer, ".o_cw_popover img", 5, "should have 5 avatar");
    });

    QUnit.test("open form view", async (assert) => {
        assert.expect(3);

        const expectedRequests = [
            {
                type: "ir.actions.act_window",
                res_id: 4,
                res_model: "event",
                views: [["A view", "form"]],
                target: "current",
                context: {},
            },
            {
                type: "ir.actions.act_window",
                res_model: "event",
                views: [[false, "form"]],
                target: "current",
                context: {
                    default_name: "coucou",
                    default_start: "2016-12-27 00:00:00",
                    default_stop: "2016-12-27 00:00:00",
                    default_allday: true,
                },
            },
        ];
        let requestCount = 0;

        serviceRegistry.add(
            "action",
            {
                ...actionService,
                start() {
                    const result = actionService.start(...arguments);
                    const doAction = result.doAction;
                    result.doAction = (request) => {
                        assert.deepEqual(request, expectedRequests[requestCount]);
                        requestCount++;
                        return doAction(request);
                    };
                    return result;
                },
            },
            { force: true }
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                />
            `,
            mockRPC(route, { method }) {
                if (method === "get_formview_id") {
                    return Promise.resolve("A view");
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickEvent(calendar, 4);
        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_edit");

        // create a new event and edit it
        await clickDate(calendar, "2016-12-27");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
        assert.strictEqual(requestCount, 2);
    });

    QUnit.skip("create and edit event in month mode (all_day: false)", async (assert) => {
        assert.expect(2);

        patchTimeZone(-240);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                />
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // create a new event and edit it
        await clickDate(calendar, "2016-12-27");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");

        // testUtils.mock.intercept(calendar, 'do_action', function (event) {
        //     assert.deepEqual(event.data.action,
        //         {
        //             type: "ir.actions.act_window",
        //             res_model: "event",
        //             views: [[false, "form"]],
        //             target: "current",
        //             context: {
        //                 "default_name": "coucou",
        //                 "default_start": "2016-12-27 11:00:00", // 7:00 + 4h
        //                 "default_stop": "2016-12-27 23:00:00", // 19:00 + 4h
        //             }
        //         },
        //         "should open the form view with the context default values");
        // });
    });

    QUnit.skip("show start time of single day event for month mode", async (assert) => {
        assert.expect(4);

        patchTimeZone(-240);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                />
            `,
        });

        assert.strictEqual(
            findEvent(calendar, 2).querySelector(".fc-content .fc-time").textContent,
            "06:55",
            "should have a correct time 06:55 AM in month mode"
        );
        assert.containsNone(
            findEvent(calendar, 4),
            ".fc-content .fc-time",
            "should not display a time for all day event"
        );
        assert.containsNone(
            findEvent(calendar, 5),
            ".fc-content .fc-time",
            "should not display a time for multiple days event"
        );

        // switch to week mode
        await changeScale(calendar, "week");
        assert.containsNone(
            findEvent(calendar, 2),
            ".fc-content .fc-time",
            "should not show time in week mode as week mode already have time on y-axis"
        );
    });

    QUnit.test("start time should not shown for date type field", async (assert) => {
        assert.expect(1);
        patchTimeZone(-240);

        serverData.models.event.fields.start.type = "date";

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                />
            `,
        });

        assert.containsNone(
            findEvent(calendar, 2),
            ".fc-content .fc-time",
            "should not show time for date type field"
        );
    });

    QUnit.test("start time should not shown in month mode if hide_time is true", async (assert) => {
        assert.expect(1);
        patchTimeZone(-240);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                    hide_time="1"
                />
            `,
        });

        assert.containsNone(
            findEvent(calendar, 2),
            ".fc-content .fc-time",
            "should not show time for hide_time attribute"
        );
    });

    QUnit.test("readonly date_start field", async (assert) => {
        assert.expect(4);

        serverData.models.event.fields.start.readonly = true;

        const expectedRequests = [
            {
                type: "ir.actions.act_window",
                res_id: 4,
                res_model: "event",
                views: [[false, "form"]],
                target: "current",
                context: {},
            },
            {
                type: "ir.actions.act_window",
                res_model: "event",
                views: [[false, "form"]],
                target: "current",
                context: {
                    default_name: "coucou",
                    default_start: "2016-12-27 00:00:00",
                    default_stop: "2016-12-27 00:00:00",
                    default_allday: true,
                },
            },
        ];
        let requestCount = 0;

        serviceRegistry.add(
            "action",
            {
                ...actionService,
                start() {
                    const result = actionService.start(...arguments);
                    const doAction = result.doAction;
                    result.doAction = (request) => {
                        assert.deepEqual(request, expectedRequests[requestCount]);
                        requestCount++;
                        return doAction(request);
                    };
                    return result;
                },
            },
            { force: true }
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                />
            `,
            mockRPC(route, { method }) {
                if (method === "get_formview_id") {
                    return Promise.resolve(false);
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        assert.containsNone(calendar.el, ".fc-resizer", "should not have resize button");

        await clickEvent(calendar, 4);
        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_edit");

        // create a new event and edit it
        await clickDate(calendar, "2016-12-27");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
        assert.strictEqual(requestCount, 2);
    });

    QUnit.test("check filters with filter_field specified", async (assert) => {
        assert.expect(5);

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
                >
                    <field
                        name="partner_ids"
                        write_model="filter_partner"
                        write_field="partner_id"
                        filter_field="partner_checked"
                    />
                </calendar>
            `,
        });

        assert.containsOnce(
            findFilterPanelFilter(calendar, "partner_ids", 2),
            "input:checked",
            "checkbox should be checked"
        );

        await toggleFilter(calendar, "partner_ids", 2);
        assert.containsNone(
            findFilterPanelFilter(calendar, "partner_ids", 2),
            "input:checked",
            "checkbox should not be checked"
        );
        assert.strictEqual(
            serverData.models.filter_partner.records.find((r) => r.id === 2).partner_checked,
            false,
            "the status of this filter should now be false"
        );

        await changeScale(calendar, "week"); // trick to reload the entire view
        assert.containsNone(
            findFilterPanelFilter(calendar, "partner_ids", 2),
            "input:checked",
            "checkbox should not be checked after the reload"
        );
        assert.strictEqual(
            serverData.models.filter_partner.records.find((r) => r.id === 2).partner_checked,
            false,
            "the status of this filter should still be false after the reload"
        );
    });

    QUnit.test('"all" filter', async (assert) => {
        assert.expect(8);

        const interval = [
            ["start", "<=", "2016-12-17 23:59:59"],
            ["stop", ">=", "2016-12-11 00:00:00"],
        ];

        const expectedDomains = [
            interval.concat([["partner_ids", "in", []]]),
            interval.concat([["partner_ids", "in", [1]]]),
            interval.concat([["partner_ids", "in", [1, 2]]]),
            interval,
        ];

        let requestCount = 0;

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
                >
                    <field
                        name="partner_ids"
                        write_model="filter_partner"
                        write_field="partner_id"
                    />
                </calendar>
            `,
            mockRPC(route, { kwargs, method, model }) {
                if (method === "search_read" && model === "event") {
                    assert.deepEqual(kwargs.domain, expectedDomains[requestCount]);
                    requestCount++;
                }
            },
        });

        // By default, no user is selected
        assert.containsNone(calendar.el, ".fc-event", "should not display any event on the week");

        await toggleFilter(calendar, "partner_ids", 1);
        assert.containsN(calendar.el, ".fc-event", 4, "should display 4 events on the week");

        await toggleFilter(calendar, "partner_ids", 2);
        assert.containsN(calendar.el, ".fc-event", 9, "should display 9 events on the week");

        // Click on the "all" filter to reload all events
        await toggleFilter(calendar, "partner_ids", "all");
        assert.containsN(calendar.el, ".fc-event", 9, "should display 9 events on the week");
    });

    QUnit.test("Add filters and specific color", async (assert) => {
        assert.expect(5);

        serverData.models.event.records.push(
            {
                id: 8,
                user_id: 4,
                partner_id: 1,
                name: "event 8",
                start: "2016-12-11 09:00:00",
                stop: "2016-12-11 10:00:00",
                allday: false,
                partner_ids: [1, 2, 3],
                event_type_id: 3,
                color: 4,
            },
            {
                id: 9,
                user_id: 4,
                partner_id: 1,
                name: "event 9",
                start: "2016-12-11 19:00:00",
                stop: "2016-12-11 20:00:00",
                allday: false,
                partner_ids: [1, 2, 3],
                event_type_id: 1,
                color: 1,
            }
        );

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
                    color="color"
                >
                    <field
                        name="partner_ids"
                        write_model="filter_partner"
                        write_field="partner_id"
                    />
                    <field
                        name="event_type_id"
                        filters="1"
                        color="color"
                    />
                </calendar>
            `,
        });

        // By default no filter is selected. We check before continuing.
        await toggleSectionFilter(calendar, "partner_ids");

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--section",
            2,
            "should display 2 sections"
        );

        const typeSection = findFilterPanelSection(calendar, "event_type_id");
        assert.strictEqual(
            typeSection.querySelector(".o-calendar-filter-panel--section-header").textContent,
            "Event Type",
            "should display 'Event Type' filter"
        );
        assert.containsN(
            typeSection,
            ".o-calendar-filter-panel--filter",
            4,
            "should display 4 filters (1 section filter + 3 filters in the section)"
        );

        assert.containsOnce(
            typeSection,
            `.o-calendar-filter-panel--filter[data-value="3"].o-calendar-filter-panel--filter-color-4`,
            "Filter for event type 3 must have the color 4"
        );
        assert.containsOnce(
            calendar.el,
            `.fc-event[data-event-id="8"].o-calendar--event-color-4`,
            "Event of event type 3 must have the color 4"
        );
    });

    QUnit.test("create event with filters", async (assert) => {
        assert.expect(7);

        serverData.models.event.fields.user_id.default = 5;
        serverData.models.event.fields.partner_id.default = 3;
        serverData.models.user.records.push({ id: 5, display_name: "user 5", partner_id: 3 });

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
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                    <field name="partner_id" filters="1" invisible="1" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // By default only
        await toggleFilter(calendar, "partner_ids", 1);

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            5,
            "should display 5 filter items"
        );
        assert.containsN(calendar.el, ".fc-event", 4, "should display 4 events");

        // quick create a record
        await selectTimeRange(calendar, "2016-12-15 06:00:00", "2016-12-15 08:00:00");

        let input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            6,
            "should add the missing filter (active)"
        );
        assert.containsN(calendar.el, ".fc-event", 5, "should display the created item");

        // change default value for quick create an hide record
        serverData.models.event.fields.user_id.default = 4;
        serverData.models.event.fields.partner_id.default = 4;

        // Disable our filter to create a record without displaying it
        await toggleFilter(calendar, "partner_id", 4);

        // quick create and other record
        await selectTimeRange(calendar, "2016-12-13 06:00:00", "2016-12-13 08:00:00");

        input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou 2";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            6,
            "should have the same filters"
        );
        assert.containsN(calendar.el, ".fc-event", 4, "should not display the created item");

        await toggleFilter(calendar, "partner_id", 4);
        await toggleFilter(calendar, "partner_ids", 2);

        assert.containsN(calendar.el, ".fc-event", 11, "should display all records");
    });

    QUnit.test("create event with filters (no quickCreate)", async (assert) => {
        assert.expect(4);

        serverData.views["event,false,form"] = `
            <form>
                <group>
                    <field name="name" />
                    <field name="start" />
                    <field name="stop" />
                    <field name="user_id" />
                    <field name="partner_id" invisible="1" />
                </group>
            </form>
        `;
        serverData.models.event.fields.user_id.default = 5;
        serverData.models.event.fields.partner_id.default = 3;
        serverData.models.user.records.push({ id: 5, display_name: "user 5", partner_id: 3 });

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
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                    <field name="partner_id" filters="1" invisible="1" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // dislay all attendee calendars
        await toggleSectionFilter(calendar, "partner_ids");
        await toggleFilter(calendar, "partner_id", 4);

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            5,
            "should display 5 filter items"
        );
        assert.containsN(calendar.el, ".fc-event", 3, "should display 3 events");

        // quick create a record
        await selectTimeRange(calendar, "2016-12-15 06:00:00", "2016-12-15 08:00:00");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "coucou";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--edit-btn");
        await click(mainComponentsContainer.querySelector(".modal-footer button.btn-primary"));

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            6,
            "should add the missing filter (active)"
        );
        assert.containsN(calendar.el, ".fc-event", 4, "should display the created item");
    });

    QUnit.skip("Update event with filters", async (assert) => {
        assert.expect(12);

        const records = serverData.models.user.records;
        records.push({ id: 5, display_name: "user 5", partner_id: 3 });
        serverData.models.event.onchanges = {
            user_id(obj) {
                obj.partner_id = records.find((r) => r.id === obj.user_id).partner_id;
            },
        };
        serverData.views["event,false,form"] = `
            <form>
                <group>
                    <field name="name" />
                    <field name="start" />
                    <field name="stop" />
                    <field name="user_id" />
                    <field name="partner_ids" widget="many2many_tags" />
                </group>
            </form>
        `;

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
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                    <field name="partner_id" filters="1" invisible="1" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // select needed partner filters
        await toggleFilter(calendar, "partner_ids", 1);
        await toggleFilter(calendar, "partner_id", 4);

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            5,
            "should display 5 filter items"
        );
        assert.containsN(calendar.el, ".fc-event", 3, "should display 3 events");

        await clickEvent(calendar, 2);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );

        await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_edit");
        assert.strictEqual(
            mainComponentsContainer.querySelector(".modal .modal-title").textContent,
            "Open: event 2",
            "dialog should have a valid title"
        );

        await click(mainComponentsContainer, `.modal .o_field_widget[name="user_id"] input`);
        await click(
            document.body.querySelectorAll(".ui-autocomplete.dropdown-menu .ui-menu-item")[2]
        );
        await click(mainComponentsContainer, ".modal button.btn-primary");

        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            6,
            "should add the missing filter (active)"
        );
        assert.containsN(calendar.el, ".fc-event", 3, "should display the updated item");

        // test the behavior of the 'select all' input checkbox
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter input:checked",
            3,
            "should display 3 active checkbox"
        );
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter) .o-calendar-filter-panel--filter input:not(:checked)",
            3,
            "should display 3 inactive checkbox"
        );

        // Click to select all users
        await toggleSectionFilter(calendar, "partner_id");

        // should contains 4 events
        assert.containsN(calendar.el, ".fc-event", 4, "should display the updated events");

        // Should have 4 checked boxes
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter input:checked",
            4,
            "should display 4 active checkbox"
        );

        // unselect all user
        await toggleSectionFilter(calendar, "partner_id");
        assert.containsN(calendar.el, ".fc-event", 0, "should not display any event");
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter input:checked",
            1,
            "should display 1 true checkbox"
        );
    });

    QUnit.test("change pager with filters", async (assert) => {
        assert.expect(3);

        serverData.models.user.records.push({ id: 5, display_name: "user 5", partner_id: 3 });
        serverData.models.event.records.push(
            {
                id: 8,
                user_id: 5,
                partner_id: 3,
                name: "event 8",
                start: "2016-12-06 04:00:00",
                stop: "2016-12-06 08:00:00",
                allday: false,
                partner_ids: [1, 2, 3],
                type: 1,
            },
            {
                id: 9,
                user_id: uid,
                partner_id: 1,
                name: "event 9",
                start: "2016-12-07 04:00:00",
                stop: "2016-12-07 08:00:00",
                allday: false,
                partner_ids: [1, 2, 3],
                type: 1,
            },
            {
                id: 10,
                user_id: 4,
                partner_id: 4,
                name: "event 10",
                start: "2016-12-08 04:00:00",
                stop: "2016-12-08 08:00:00",
                allday: false,
                partner_ids: [1, 2, 3],
                type: 1,
            }
        );

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
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                    <field name="partner_id" filters="1" invisible="1" />
                </calendar>
            `,
        });

        // select filter for partner 1, 2 and 4
        await toggleSectionFilter(calendar, "partner_ids");
        await toggleFilter(calendar, "partner_id", 4);
        await navigate(calendar, "previous");
        assert.containsN(
            calendar.el,
            ".o-calendar-filter-panel--filter:not(.o-calendar-filter-panel--section-filter)",
            6,
            "should display 6 filter items"
        );
        assert.containsN(calendar.el, ".fc-event", 2, "should display 2 events");
        const events = calendar.el.querySelectorAll(".fc-event .o_event_title");
        assert.strictEqual(
            Array.from(events)
                .map((e) => e.textContent)
                .join("")
                .replace(/\s/g, ""),
            "event8event9",
            "should display 2 events"
        );
    });

    QUnit.test("ensure events are still shown if filters give an empty domain", async (assert) => {
        assert.expect(2);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar date_start="start" mode="week">
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                </calendar>
            `,
        });

        await toggleSectionFilter(calendar, "partner_ids");
        assert.containsN(calendar.el, ".fc-event", 5, "should display 5 events");

        await toggleFilter(calendar, "partner_ids", "all");
        assert.containsN(calendar.el, ".fc-event", 5, "should display 5 events");
    });

    QUnit.test("events starting at midnight", async (assert) => {
        assert.expect(2);

        //     translateParameters: { // Avoid issues due to localization formats
        //         time_format: "%H:%M:%S",
        //     },

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar date_start="start" mode="week" event_open_popup="1" />
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // // Click on Tuesday 12am
        await selectTimeRange(calendar, "2016-12-13 00:00:00", "2016-12-13 00:30:00");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the quick create dialog"
        );

        // Creating the event
        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
        assert.strictEqual(
            findEvent(calendar, 8).textContent,
            "new event in quick create",
            "should display the new record after quick create dialog"
        );
    });

    QUnit.test("set event as all day when field is date", async (assert) => {
        assert.expect(2);

        patchTimeZone(-480);
        serverData.models.event.records[0].start_date = "2016-12-14";

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start_date"
                    all_day="allday"
                    mode="week"
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
                </calendar>
            `,
        });

        await toggleFilter(calendar, "partner_ids", 1);
        assert.containsOnce(
            calendar.el,
            ".fc-day-grid .fc-event-container",
            "should be one event in the all day row"
        );

        assert.strictEqual(calendar.model.records[1].start.day, 14, "the date should be 14");
    });

    QUnit.test(
        "set event as all day when field is date (without all_day mapping)",
        async (assert) => {
            assert.expect(1);

            serverData.models.event.records[0].start_date = "2016-12-14";

            const calendar = await makeView({
                type: "wowl_calendar",
                resModel: "event",
                serverData,
                arch: `
                    <calendar date_start="start_date" mode="week" />
                `,
            });

            assert.containsOnce(
                calendar.el,
                ".fc-day-grid .fc-event-container",
                "should be one event in the all day row"
            );
        }
    );

    QUnit.test("quickcreate avoid double event creation", async (assert) => {
        assert.expect(1);
        let createCount = 0;
        const def = makeDeferred();

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                    event_open_popup="1"
                />
            `,
            mockRPC(route, { method }, performRPC) {
                if (method === "create") {
                    createCount++;
                    return def.then(() => performRPC(...arguments));
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // create a new event
        await clickDate(calendar, "2016-12-13");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create";
        await triggerEvent(input, null, "input");

        // Simulate ENTER pressed on Create button (after a TAB)
        await triggerEvent(input, null, "keyup", { key: "Enter" });
        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        def.resolve();
        await nextTick();
        assert.strictEqual(createCount, 1, "should create only one event");
    });

    QUnit.test("calendar is configured to have no groupBy menu", async (assert) => {
        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar date_start="start" />
            `,
        });
        assert.containsNone(
            calendar.el,
            ".o_control_panel .o_group_by_menu",
            "the control panel has no groupBy menu"
        );
    });

    QUnit.test("timezone does not affect current day", async (assert) => {
        assert.expect(2);

        patchTimeZone(-2400);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar date_start="start" />
            `,
        });
        assert.strictEqual(
            findPickedDate(calendar).textContent,
            "12",
            "should highlight the target day"
        );

        await pickDate(calendar, "2016-12-11");
        assert.strictEqual(
            findPickedDate(calendar).textContent,
            "11",
            "should highlight the selected day"
        );
    });

    QUnit.skip("timezone does not affect drag and drop", async (assert) => {
        assert.expect(10);

        patchTimeZone(-2400);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    mode="month"
                >
                    <field name="name" />
                    <field name="start" />
                </calendar>
            `,
            mockRPC(route, { method, args }) {
                if (method === "write") {
                    assert.deepEqual(args[0], [6], "event 6 is moved");
                    assert.strictEqual(
                        args[1].start,
                        "2016-11-29 08:00:00",
                        "event moved to 27th nov 16h00 +40 hours timezone"
                    );
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        assert.strictEqual(findEvent(calendar, 1).textContent.replace(/\s/g, ""), "08:00event1");
        await clickEvent(calendar, 1);
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.o_field_widget[name="start"]`).textContent,
            "12/09/2016 08:00:00"
        );

        assert.strictEqual(findEvent(calendar, 6).textContent.replace(/\s/g, ""), "16:00event6");
        await clickEvent(calendar, 6);
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.o_field_widget[name="start"]`).textContent,
            "12/16/2016 16:00:00"
        );

        // Move event 6 as on first day of month view (27th november 2016)
        await moveEventToDate(calendar, 6, "2016-11-27");

        assert.strictEqual(findEvent(calendar, 1).textContent.replace(/\s/g, ""), "08:00event1");
        await clickEvent(calendar, 1);
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.o_field_widget[name="start"]`).textContent,
            "12/09/2016 08:00:00"
        );

        assert.strictEqual(findEvent(calendar, 6).textContent.replace(/\s/g, ""), "16:00event6");
        await clickEvent(calendar, 6);
        assert.strictEqual(
            mainComponentsContainer.querySelector(`.o_field_widget[name="start"]`).textContent,
            "11/27/2016 16:00:00"
        );
    });

    QUnit.test("timzeone does not affect calendar with date field", async (assert) => {
        assert.expect(11);

        patchTimeZone(120);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start_date"
                    mode="month"
                >
                    <field name="name" />
                    <field name="start_date" />
                </calendar>
            `,
            mockRPC(route, { method, args }) {
                if (method === "create") {
                    assert.strictEqual(args[0].start_date, "2016-12-20 00:00:00");
                }
                if (method === "write") {
                    assert.step(args[1].start_date);
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // Create event (on 20 december)
        await clickDate(calendar, "2016-12-20");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "An event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        await clickEvent(calendar, 8);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(
                ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item .o_field_date"
            ).textContent,
            "12/20/2016",
            "should have correct start date"
        );

        // Move event to another day (on 27 november)
        await moveEventToDate(calendar, 8, "2016-11-27");
        assert.verifySteps(["2016-11-27 00:00:00"]);

        await clickEvent(calendar, 8);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(
                ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item .o_field_date"
            ).textContent,
            "11/27/2016",
            "should have correct start date"
        );

        // Move event to last day (on 7 january)
        await moveEventToDate(calendar, 8, "2017-01-07");
        assert.verifySteps(["2017-01-07 00:00:00"]);

        await clickEvent(calendar, 8);
        assert.containsOnce(
            mainComponentsContainer,
            ".o_cw_popover",
            "should open a popover clicking on event"
        );
        assert.strictEqual(
            mainComponentsContainer.querySelector(
                ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item .o_field_date"
            ).textContent,
            "01/07/2017",
            "should have correct start date"
        );
    });

    QUnit.test("drag and drop on month mode", async (assert) => {
        assert.expect(2);

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
                    quick_add="0"
                >
                    <field name="name" />
                    <field name="partner_id" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // Create event (on 20 december)
        await clickDate(calendar, "2016-12-20");
        const input = mainComponentsContainer.querySelector(".modal-body input");
        input.value = "An event";
        await triggerEvent(input, null, "input");
        await click(mainComponentsContainer.querySelector(".modal button.btn-primary"));

        await moveEventToDate(calendar, 1, "2016-12-19", { disableDrop: true });
        assert.hasClass(
            calendar.el.querySelector(`.o-calendar-common-renderer > [data-event-id="1"]`),
            "fc-dragging",
            "should have fc-dragging class"
        );

        // Move event to another day (on 19 december)
        await moveEventToDate(calendar, 8, "2016-12-19");
        await clickEvent(calendar, 8);

        const row = mainComponentsContainer.querySelectorAll(".o_cw_body .list-group-item")[1];
        assert.strictEqual(
            row.textContent.trim(),
            "07:00 - 19:00 (12 hours)",
            "start and end hours shouldn't have been changed"
        );
    });

    QUnit.skip("drag and drop on month mode with all_day mapping", async (assert) => {
        // Same test as before but in normalizeRecord (calendar_model.js) there is
        // different condition branching with all_day mapping or not
        assert.expect(1);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                    event_open_popup="1"
                    quick_add="0"
                >
                    <field name="name" />
                    <field name="partner_id" />
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // Create event (on 20 december)
        await clickDate(calendar, "2016-12-20");

        const input = mainComponentsContainer.querySelector(".modal-body input");
        input.value = "An event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer.querySelector(`.o_field_widget[name="allday"] input`));

        // use datepicker to enter a date: 12/20/2016 07:00:00
        await click(
            mainComponentsContainer,
            `.o_field_widget[name="start"].o_datepicker .o_datepicker_input`
        );
        await click(
            document.body,
            `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
        );
        await click(document.body, `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`);
        await click(
            document.body.querySelectorAll(
                `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
            )[7]
        );
        await click(
            document.body,
            `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
        );

        // use datepicker to enter a date: 12/20/2016 19:00:00
        await click(
            mainComponentsContainer,
            `.o_field_widget[name="stop"].o_datepicker .o_datepicker_input`
        );
        await click(
            document.body,
            `.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]`
        );
        await click(document.body, `.bootstrap-datetimepicker-widget .timepicker .timepicker-hour`);
        await click(
            document.body.querySelectorAll(
                `.bootstrap-datetimepicker-widget .timepicker-hours td.hour`
            )[19]
        );
        await click(
            document.body,
            `.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]`
        );

        await click(mainComponentsContainer.querySelector(".modal button.btn-primary"));

        // Move event to another day (on 19 december)
        await moveEventToDate(calendar, 8, "2016-12-19");
        await clickEvent(calendar, 8);

        const row = mainComponentsContainer.querySelectorAll(".o_cw_body .list-group-item")[1];
        assert.strictEqual(
            row.textContent.trim(),
            "07:00 - 19:00 (12 hours)",
            "start and end hours shouldn't have been changed"
        );
    });

    QUnit.test("drag and drop on month mode with date_start and date_delay", async (assert) => {
        assert.expect(1);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_delay="delay"
                    mode="month"
                >
                    <field name="name" />
                    <field name="start" />
                    <field name="delay" />
                </calendar>
            `,
            mockRPC(route, { args, method }) {
                if (method === "write") {
                    // delay should not be written at drag and drop
                    assert.strictEqual(args[1].delay, undefined);
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        // Create event (on 20 december)
        await clickDate(calendar, "2016-12-20");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "An event";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");

        // Move event to another day (on 27 november)
        await moveEventToDate(calendar, 8, "2016-11-27");
    });

    QUnit.test("form_view_id attribute works (for creating events)", async (assert) => {
        assert.expect(1);

        serviceRegistry.add(
            "action",
            {
                ...actionService,
                start() {
                    const result = actionService.start(...arguments);
                    const doAction = result.doAction;
                    result.doAction = (request) => {
                        assert.strictEqual(
                            request.views[0][0],
                            42,
                            "should do a do_action with view id 42"
                        );
                        return doAction(request);
                    };
                    return result;
                },
            },
            { force: true }
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                    form_view_id="42"
                />
            `,
            mockRPC(route, { method }) {
                if (method === "create") {
                    return Promise.reject();
                }
            },
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await clickDate(calendar, "2016-12-13");

        const input = mainComponentsContainer.querySelector(".o-calendar-quick-create--input");
        input.value = "new event in quick create";
        await triggerEvent(input, null, "input");

        await click(mainComponentsContainer, ".o-calendar-quick-create--create-btn");
    });

    QUnit.test("form_view_id attribute works with popup (for creating events)", async (assert) => {
        assert.expect(1);

        serviceRegistry.add(
            "action",
            {
                ...actionService,
                start() {
                    const result = actionService.start(...arguments);
                    const doAction = result.doAction;
                    result.doAction = (request) => {
                        assert.strictEqual(request.views[0][0], 1, "should load view with id 1");
                        return doAction(request);
                    };
                    return result;
                },
            },
            { force: true }
        );

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                    open_event_popup="1"
                    quick_add="0"
                    form_view_id="1"
                />
            `,
        });

        await clickDate(calendar, "2016-12-13");
    });

    QUnit.todo("fullcalendar initializes with right locale", async (assert) => {
        // BOI to discuss in review: I think this test should be removed
        assert.ok(false);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                />
            `,
        });

        // assert.expect(1);

        // var initialLocale = moment.locale();
        // // This will set the locale to zz
        // moment.defineLocale('zz', {
        //     longDateFormat: {
        //         L: 'DD/MM/YYYY'
        //     },
        //     weekdaysShort: ["zz1.", "zz2.", "zz3.", "zz4.", "zz5.", "zz6.", "zz7."],
        // });

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch: '<calendar class="o_calendar_test" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'mode="week"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //         action: {views: [{viewID: 1, type: 'kanban'}, {viewID: 43, type: 'form'}]}
        //     },

        // });

        // assert.strictEqual(calendar.$('.fc-day-header:first').text(), "zz1. 11",
        //     'The day should be in the given locale specific format');

        // moment.locale(initialLocale);
        // moment.defineLocale('zz', null);

        // calendar.destroy();
    });

    QUnit.todo("initial_date given in the context", async (assert) => {
        assert.ok(false);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                />
            `,
        });

        // assert.expect(1);

        // serverData.views = {
        //     'event,1,calendar': '<calendar date_start="start" date_stop="stop" mode="day"/>',
        //     'event,false,search': '<search></search>',
        // };

        // serverData.actions = {
        //     1: {
        //         id: 1,
        //         name: 'context initial date',
        //         res_model: 'event',
        //         type: 'ir.actions.act_window',
        //         views: [[1, 'calendar']],
        //         context: {initial_date: initialDate}
        //     },
        // };

        // const webClient = await createWebClient({ serverData });
        // await doAction(webClient, 1);
        // await testUtils.nextTick();
        // assert.strictEqual($('.o_control_panel .breadcrumb-item').text(),
        //     'context initial date (December 12, 2016)', "should display day passed in the context");
    });

    QUnit.test("default week start (US) month mode", async (assert) => {
        assert.expect(8);

        // 2019-09-12 08:00:00
        patchDate(2019, 8, 12, 8, 0, 0);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    mode="month"
                />
            `,
            mockRPC(route, { method, model, kwargs }) {
                if (model === "event" && method === "search_read") {
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2019-10-12 23:59:59"],
                            ["stop", ">=", "2019-09-01 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Sunday",
            "The first day of the week should be Sunday"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Saturday",
            "The last day of the week should be Saturday"
        );

        const dayTops = calendar.el.querySelectorAll(".fc-day-top");
        assert.strictEqual(
            dayTops[0].querySelector(".fc-week-number").textContent,
            "35",
            "The number of the week should be correct"
        );
        assert.strictEqual(dayTops[0].querySelector(".fc-day-number").textContent, "1");
        assert.strictEqual(dayTops[0].dataset.date, "2019-09-01");
        assert.strictEqual(
            dayTops[dayTops.length - 1].querySelector(".fc-day-number").textContent,
            "12"
        );
        assert.strictEqual(dayTops[dayTops.length - 1].dataset.date, "2019-10-12");
    });

    QUnit.test("European week start month mode", async (assert) => {
        assert.expect(8);

        // 2019-09-15 08:00:00
        patchDate(2019, 8, 15, 8, 0, 0);

        // the week start depends on the locale
        serviceRegistry.add(
            "localization",
            mocks.localization({
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
                    mode="month"
                />
            `,
            mockRPC(route, { method, model, kwargs }) {
                if (model === "event" && method === "search_read") {
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2019-10-06 23:59:59"],
                            ["stop", ">=", "2019-08-26 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Monday",
            "The first day of the week should be Monday"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Sunday",
            "The last day of the week should be Sunday"
        );

        const dayTops = calendar.el.querySelectorAll(".fc-day-top");
        assert.strictEqual(
            dayTops[0].querySelector(".fc-week-number").textContent,
            "35",
            "The number of the week should be correct"
        );
        assert.strictEqual(dayTops[0].querySelector(".fc-day-number").textContent, "26");
        assert.strictEqual(dayTops[0].dataset.date, "2019-08-26");
        assert.strictEqual(
            dayTops[dayTops.length - 1].querySelector(".fc-day-number").textContent,
            "6"
        );
        assert.strictEqual(dayTops[dayTops.length - 1].dataset.date, "2019-10-06");
    });

    QUnit.test("Monday week start week mode", async (assert) => {
        assert.expect(3);

        // 2019-09-15 08:00:00
        patchDate(2019, 8, 15, 8, 0, 0);

        // the week start depends on the locale
        serviceRegistry.add(
            "localization",
            mocks.localization({
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
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2019-09-15 23:59:59"],
                            ["stop", ">=", "2019-09-09 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Mon 9",
            "The first day of the week should be Monday the 9th"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Sun 15",
            "The last day of the week should be Sunday the 15th"
        );
    });

    QUnit.test("Saturday week start week mode", async (assert) => {
        assert.expect(3);

        // 2019-09-12 08:00:00
        patchDate(2019, 8, 12, 8, 0, 0);

        // the week start depends on the locale
        serviceRegistry.add(
            "localization",
            mocks.localization({
                weekStart: 6,
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
                    assert.deepEqual(
                        kwargs.domain,
                        [
                            ["start", "<=", "2019-09-13 23:59:59"],
                            ["stop", ">=", "2019-09-07 00:00:00"],
                        ],
                        "The domain to search events in should be correct"
                    );
                }
            },
        });

        const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
        assert.strictEqual(
            dayHeaders[0].textContent,
            "Sat 7",
            "The first day of the week should be Saturday the 7th"
        );
        assert.strictEqual(
            dayHeaders[dayHeaders.length - 1].textContent,
            "Fri 13",
            "The last day of the week should be Friday the 13th"
        );
    });

    QUnit.test(
        'edit record and attempt to create a record with "create" attribute set to false',
        async (assert) => {
            assert.expect(8);

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
                        create="0"
                    />
                `,
                mockRPC(route, { args, method }) {
                    if (method === "write") {
                        assert.deepEqual(
                            args[1],
                            { name: "event 4 modified" },
                            "should update the record"
                        );
                    }
                },
            });

            const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
            });

            // editing existing events should still be possible
            // click on an existing event to open the formViewDialog

            await clickEvent(calendar, 4);
            assert.containsOnce(
                mainComponentsContainer,
                ".o_cw_popover",
                "should open a popover clicking on event"
            );
            assert.containsOnce(
                mainComponentsContainer,
                ".o_cw_popover .o_cw_popover_edit",
                "popover should have an edit button"
            );
            assert.containsOnce(
                mainComponentsContainer,
                ".o_cw_popover .o_cw_popover_delete",
                "popover should have a delete button"
            );
            assert.containsOnce(
                mainComponentsContainer,
                ".o_cw_popover .o_cw_popover_close",
                "popover should have a close button"
            );

            await click(mainComponentsContainer, ".o_cw_popover .o_cw_popover_edit");
            assert.containsOnce(
                mainComponentsContainer,
                ".modal-body",
                "should open the form view in dialog when click on edit"
            );

            let input = mainComponentsContainer.querySelector(".modal-body input");
            input.value = "event 4 modified";
            await triggerEvent(input, null, "input");

            await click(mainComponentsContainer.querySelector(".modal-footer button.btn-primary"));
            assert.containsNone(
                mainComponentsContainer,
                ".modal",
                "save button should close the modal"
            );

            // creating an event should not be possible
            // attempt to create a new event with create set to false

            await clickDate(calendar, "2016-12-13");
            assert.containsNone(
                mainComponentsContainer,
                ".modal",
                "shouldn't open a quick create dialog for creating a new event with create attribute set to false"
            );
        }
    );

    QUnit.test(
        'attempt to create record with "create" and "quick_add" attributes set to false',
        async (assert) => {
            assert.expect(1);

            const calendar = await makeView({
                type: "wowl_calendar",
                resModel: "event",
                serverData,
                arch: `
                    <calendar
                        date_start="start"
                        date_stop="stop"
                        mode="month"
                        create="0"
                        event_open_popup="1"
                        quick_create="0"
                    />
                `,
            });

            const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
                clearTimeout: () => {},
            });

            // attempt to create a new event with create set to false

            await clickDate(calendar, "2016-12-13");
            assert.containsNone(
                mainComponentsContainer,
                ".modal",
                "shouldn't open a form view for creating a new event with create attribute set to false"
            );
        }
    );

    QUnit.test(
        "attempt to create multiples events and the same day and check the ordering on month view",
        async (assert) => {
            assert.expect(3);

            // This test aims to verify that the order of the event in month view is coherent with their start date.
            // 12 of March
            patchDate(2020, 2, 12, 8, 0, 0);

            serverData.models.event.records = [
                {
                    id: 1,
                    name: "Second event",
                    start: "2020-03-12 05:00:00",
                    stop: "2020-03-12 07:00:00",
                    allday: false,
                },
                {
                    id: 2,
                    name: "First event",
                    start: "2020-03-12 02:00:00",
                    stop: "2020-03-12 03:00:00",
                    allday: false,
                },
                {
                    id: 3,
                    name: "Third event",
                    start: "2020-03-12 08:00:00",
                    stop: "2020-03-12 09:00:00",
                    allday: false,
                },
            ];

            const calendar = await makeView({
                type: "wowl_calendar",
                resModel: "event",
                serverData,
                arch: `
                    <calendar
                        date_start="start"
                        date_stop="stop"
                        all_day="allday"
                        mode="month"
                    />
                `,
            });

            assert.containsOnce(
                calendar.el,
                ".o-calendar .fc-view-container",
                "should display in the calendar"
            );

            // Testing the order of the events: by start date
            assert.containsN(calendar.el, ".o_event_title", 3, "3 events should be available");
            assert.strictEqual(
                calendar.el.querySelector(".o_event_title").textContent,
                "First event",
                "First event should be on top"
            );
        }
    );

    QUnit.test("drag and drop 24h event on week mode", async (assert) => {
        assert.expect(1);

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
                    event_open_popup="1"
                    quick_add="0"
                />
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await selectTimeRange(calendar, "2016-12-13 08:00:00", "2016-12-14 08:00:00");
        assert.containsNone(mainComponentsContainer, ".modal", "should not open modal");
    });

    QUnit.skip("correctly display year view", async (assert) => {
        assert.expect(19);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="year"
                    create="0"
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>
                    <field name="partner_id" filters="1" invisible="1"/>
                </calendar>
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await toggleFilter(calendar, "partner_ids", "section");

        // Check view
        assert.containsN(calendar, ".o-calendar-year-renderer--month", 12);
        assert.strictEqual(
            calendar.el.querySelector(
                ".o-calendar-year-renderer--month:first-child .fc-header-toolbar"
            ).textContent,
            "Jan 2016"
        );
        assert.containsN(
            calendar.el,
            ".fc-bgevent",
            7,
            "There should be 6 events displayed but there is 1 split on 2 weeks"
        );

        await clickDate(calendar, "2016-11-17");
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-11-16");
        await nextTick();
        assert.containsOnce(mainComponentsContainer, ".o-calendar-year-popover");

        let popoverText = mainComponentsContainer
            .querySelector(".o-calendar-year-popover")
            .textContent.replace(/\s{2,}/g, " ")
            .trim();
        assert.strictEqual(popoverText, "November 14-16, 2016event 7");
        await click(mainComponentsContainer, ".o-calendar-year-popover--close-button");
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-11-14");
        await nextTick();
        assert.containsOnce(mainComponentsContainer, ".o-calendar-year-popover");
        popoverText = mainComponentsContainer
            .querySelector(".o-calendar-year-popover")
            .textContent.replace(/\s{2,}/g, " ")
            .trim();
        assert.strictEqual(popoverText, "November 14-16, 2016event 7");
        await click(mainComponentsContainer, ".o-calendar-year-popover--close-button");
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-11-13");
        await nextTick();
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-12-10");
        await nextTick();
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-12-12");
        await nextTick();
        assert.containsOnce(mainComponentsContainer, ".o-calendar-year-popover");
        popoverText = mainComponentsContainer
            .querySelector(".o-calendar-year-popover")
            .textContent.replace(/\s{2,}/g, " ")
            .trim();
        assert.strictEqual(popoverText, "December 12, 2016 10:55event 2 15:55event 3");
        await click(mainComponentsContainer, ".o-calendar-year-popover--close-button");
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-12-14");
        await nextTick();
        assert.containsOnce(mainComponentsContainer, ".o-calendar-year-popover");
        popoverText = mainComponentsContainer
            .querySelector(".o-calendar-year-popover")
            .textContent.replace(/\s{2,}/g, " ")
            .trim();
        assert.strictEqual(popoverText, "December 14, 2016event 4 December 13-20, 2016event 5");
        await click(mainComponentsContainer, ".o-calendar-year-popover--close-button");
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");

        await clickDate(calendar, "2016-12-21");
        await nextTick();
        assert.containsNone(mainComponentsContainer, ".o-calendar-year-popover");
    });

    QUnit.test("toggle filters in year view", async (assert) => {
        assert.expect(42);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="year"
                    event_open_popup="1"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>
                    <field name="partner_id" filters="1" invisible="1"/>
                '</calendar>
            `,
        });

        function checkEvents(countMap) {
            for (const [id, count] of Object.entries(countMap)) {
                assert.containsN(calendar.el, `.fc-bgevent[data-event-id="${id}"]`, count);
            }
        }

        await toggleFilter(calendar, "partner_ids", "section");
        checkEvents({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 7: 1 });

        await toggleFilter(calendar, "partner_ids", 2);
        checkEvents({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 0, 7: 0 });

        await toggleFilter(calendar, "partner_id", 1);
        checkEvents({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 7: 0 });

        await toggleFilter(calendar, "partner_id", 4);
        checkEvents({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 7: 0 });

        await toggleFilter(calendar, "partner_ids", 1);
        checkEvents({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 7: 0 });

        await toggleFilter(calendar, "partner_ids", 2);
        checkEvents({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 7: 0 });

        await toggleFilter(calendar, "partner_id", 4);
        checkEvents({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 7: 0 });
    });

    QUnit.test("allowed scales", async (assert) => {
        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    scales="day,week"
                />
            `,
        });

        assert.containsOnce(
            calendar.el,
            ".o-calendar-view--scale-buttons .o-calendar-view--scale-button--day"
        );
        assert.containsOnce(
            calendar.el,
            ".o-calendar-view--scale-buttons .o-calendar-view--scale-button--week"
        );
        assert.containsNone(
            calendar.el,
            ".o-calendar-view--scale-buttons .o-calendar-view--scale-button--month"
        );
        assert.containsNone(
            calendar.el,
            ".o-calendar-view--scale-buttons .o-calendar-view--scale-button--year"
        );
    });

    QUnit.test("click outside the popup should close it", async (assert) => {
        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    event_open_popup="1"
                />
            `,
        });

        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        assert.containsNone(mainComponentsContainer, ".o-calendar-common-popover");

        await clickEvent(calendar, 1);
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover",
            "open popup when click on event"
        );

        await click(mainComponentsContainer, ".o-calendar-common-popover .o_cw_body");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-common-popover",
            "keep popup openned when click inside popup"
        );

        await click(calendar.el);
        assert.containsNone(
            mainComponentsContainer,
            ".o-calendar-common-popover",
            "close popup when click outside popup"
        );
    });

    QUnit.test("fields are added in the right order in popover", async (assert) => {
        assert.expect(3);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="month"
                >
                    <field name="user_id" widget="deferred_widget" />
                    <field name="name" />
                </calendar>
            `,
        });
        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        const def = makeDeferred();
        const DeferredWidget = AbstractField.extend({
            async start() {
                await this._super(...arguments);
                await def;
            },
        });
        fieldRegistry.add("deferred_widget", DeferredWidget);

        await clickEvent(calendar, 4);
        assert.containsNone(mainComponentsContainer, ".o_cw_popover");

        def.resolve();
        await nextTick();
        assert.containsOnce(mainComponentsContainer, ".o_cw_popover");

        assert.strictEqual(
            mainComponentsContainer.querySelector(".o_cw_popover .o_cw_popover_fields_secondary")
                .textContent,
            "user : name : event 4"
        );

        delete fieldRegistry.map.deferred_widget;
    });

    QUnit.test("select events and discard create", async (assert) => {
        assert.expect(3);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="year"
                    event_open_popup="1"
                />
            `,
        });
        const mainComponentsContainer = await addMainComponentsContainer(calendar.env);

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await selectDateRange(calendar, "2016-11-13", "2016-11-19");
        assert.containsOnce(
            mainComponentsContainer,
            ".o-calendar-quick-create",
            "should open the form view in dialog when select multiple days"
        );

        assert.hasAttrValue(
            calendar.el.querySelector(".fc-highlight"),
            "colspan",
            "7",
            "should highlight 7 days"
        );

        await click(mainComponentsContainer, ".o-calendar-quick-create--cancel-btn");
        assert.containsNone(calendar.el, ".fc-highlight", "should not highlight days");
    });
});
