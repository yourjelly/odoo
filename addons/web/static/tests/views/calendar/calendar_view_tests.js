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
} from "../../helpers/utils";
import { makeView } from "../helpers";
import {
    changeScale,
    clickDate,
    clickEvent,
    findEvent,
    findPickedDate,
    findTimeRow,
    moveEventToDate,
    patchTimeZone,
    pickDate,
    selectDateRange,
    selectTimeRange,
    toggleFilter,
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
        await click(calendar.el, ".o-calendar-view--navigation-button--next");
        assert.containsNone(
            calendar.el,
            ".fc-event-container .fc-event",
            "should display 0 events"
        );

        await click(calendar.el, ".o-calendar-view--navigation-button--previous");

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

    QUnit.todo("create event with timezone in week mode European locale", async (assert) => {
        assert.expect(5);

        serverData.models.event.records = [];

        serviceRegistry.add(
            "localization",
            mocks.localization({
                timeFormat: "%H:%M:%S",
            })
        );

        patchTimeZone(120);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    date_start="start"
                    date_Stop="stop"
                    all_day="allday"
                    mode="week"
                    event_open_popup="1"
                >
                    <field name="name" />
                    <field name="start" />
                    <field name="allday" />
                </calendar>
            `,
            mockRPC(route, { method, kwargs }) {
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

        // await clickEvent(calendar, 1);

        // await testUtils.dom.click($newevent);
        // await testUtils.dom.click(calendar.$('.o_cw_popover .o_cw_popover_delete'));
        // await testUtils.dom.click($('.modal button.btn-primary:contains(Ok)'));
        // assert.containsNone(calendar, '.fc-content', "should delete the record");
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

    QUnit.todo("render popover", async (assert) => {
        assert.ok(false);

        // assert.expect(14);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week">'+
        //             '<field name="name" string="Custom Name"/>'+
        //             '<field name="partner_id"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });

        // await testUtils.dom.click($('.fc-event:contains(event 4)'));

        // assert.containsOnce(calendar, '.o_cw_popover', "should open a popover clicking on event");
        // assert.strictEqual(calendar.$('.o_cw_popover .popover-header').text(), 'event 4', "popover should have a title 'event 4'");
        // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_edit', "popover should have an edit button");
        // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_delete', "popover should have a delete button");
        // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_close', "popover should have a close button");

        // assert.strictEqual(calendar.$('.o_cw_popover .list-group-item:first b.text-capitalize').text(), 'Wednesday, December 14, 2016', "should display date 'Wednesday, December 14, 2016'");
        // assert.containsN(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item', 2, "popover should have a two fields");

        // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first .o_field_char', "should apply char widget");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first strong').text(), 'Custom Name : ', "label should be a 'Custom Name'");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first .o_field_char').text(), 'event 4', "value should be a 'event 4'");

        // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_form_uri', "should apply m20 widget");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last strong').text(), 'user : ', "label should be a 'user'");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_form_uri').text(), 'partner 1', "value should be a 'partner 1'");

        // await testUtils.dom.click($('.o_cw_popover .o_cw_popover_close'));
        // assert.containsNone(calendar, '.o_cw_popover', "should close a popover");

        // calendar.destroy();
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

    QUnit.todo(
        "create event with timezone in week mode with formViewDialog European locale",
        async (assert) => {
            assert.ok(false);

            // assert.expect(8);

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

            // this.data.event.records = [];
            // this.data.event.onchanges = {
            //     allday: function (obj) {
            //         if (obj.allday) {
            //             obj.start_date = obj.start && obj.start.split(' ')[0] || obj.start_date;
            //             obj.stop_date = obj.stop && obj.stop.split(' ')[0] || obj.stop_date || obj.start_date;
            //         } else {
            //             obj.start = obj.start_date && (obj.start_date + ' 00:00:00') || obj.start;
            //             obj.stop = obj.stop_date && (obj.stop_date + ' 00:00:00') || obj.stop || obj.start;
            //         }
            //     }
            // };

            // var calendar = await createCalendarView({
            //     View: CalendarView,
            //     model: 'event',
            //     data: this.data,
            //     arch:
            //     '<calendar class="o_calendar_test" '+
            //         'event_open_popup="true" '+
            //         'date_start="start" '+
            //         'date_stop="stop" '+
            //         'all_day="allday" '+
            //         'mode="week">'+
            //             '<field name="name"/>'+
            //     '</calendar>',
            //     archs: archs,
            //     viewOptions: {
            //         initialDate: initialDate,
            //     },
            //     session: {
            //         getTZOffset: function () {
            //             return 120;
            //         },
            //     },
            //     translateParameters: { // Avoid issues due to localization formats
            //         time_format: "%H:%M:%S",
            //     },
            //     mockRPC: function (route, args) {
            //         if (args.method === "create") {
            //             assert.deepEqual(args.kwargs.context, {
            //                 "default_name": "new event",
            //                 "default_start": "2016-12-13 06:00:00",
            //                 "default_stop": "2016-12-13 08:00:00",
            //                 "default_allday": null
            //             },
            //             "should send the context to create events");
            //         }
            //         if (args.method === "write") {
            //             assert.deepEqual(args.args[1], expectedEvent,
            //                 "should move the event");
            //         }
            //         return this._super(route, args);
            //     },
            // }, {positionalClicks: true});

            // var top = calendar.$('.fc-axis:contains(8:00)').offset().top + 5;
            // var left = calendar.$('.fc-day:eq(2)').offset().left + 5;

            // try {
            //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // } catch (e) {
            //     calendar.destroy();
            //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
            // }
            // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mouseup");
            // await testUtils.nextTick();
            // await testUtils.fields.editInput($('.modal input:first'), 'new event');
            // await testUtils.dom.click($('.modal button.btn:contains(Edit)'));

            // assert.strictEqual($('.o_field_widget[name="start"] input').val(),
            //     "12/13/2016 08:00:00", "should display the datetime");

            // await testUtils.dom.click($('.modal-lg .o_field_boolean[name="allday"] input'));
            // await testUtils.nextTick();
            // assert.strictEqual($('input[name="start_date"]').val(),
            //     "12/13/2016", "should display the date");

            // await testUtils.dom.click($('.modal-lg .o_field_boolean[name="allday"] input'));

            // assert.strictEqual($('.o_field_widget[name="start"] input').val(),
            //     "12/13/2016 02:00:00", "should display the datetime from the date with the timezone");

            // // use datepicker to enter a date: 12/13/2016 08:00:00
            // testUtils.dom.openDatepicker($('.o_field_widget[name="start"].o_datepicker'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker .timepicker-hour'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker-hours td.hour:contains(08)'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]'));

            // // use datepicker to enter a date: 12/13/2016 10:00:00
            // testUtils.dom.openDatepicker($('.o_field_widget[name="stop"].o_datepicker'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker .timepicker-hour'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker-hours td.hour:contains(10)'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]'));

            // await testUtils.dom.click($('.modal-lg button.btn:contains(Save)'));
            // var $newevent = calendar.$('.fc-event:contains(new event)');

            // assert.strictEqual($newevent.find('.o_event_title').text(), "new event",
            //     "should display the new event with title");

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

            // var pos = calendar.$('.fc-content').offset();
            // left = pos.left + 5;
            // top = pos.top + 5;

            // // Mode this event to another day
            // var expectedEvent = {
            // "allday": false,
            // "start": "2016-12-12 06:00:00",
            // "stop": "2016-12-12 08:00:00"
            // };
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // left = calendar.$('.fc-day:eq(1)').offset().left + 15;
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mouseup");
            // await testUtils.nextTick();

            // // Move to "All day"
            // expectedEvent = {
            // "allday": true,
            // "start": "2016-12-12 00:00:00",
            // "stop": "2016-12-12 00:00:00"
            // };
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // top = calendar.$('.fc-day:eq(1)').offset().top + 15;
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mouseup");
            // await testUtils.nextTick();

            // calendar.destroy();
        }
    );

    QUnit.todo("create event with timezone in week mode American locale", async (assert) => {
        assert.ok(false);

        // assert.expect(5);

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

        // this.data.event.records = [];

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week">'+
        //             '<field name="name"/>'+
        //             '<field name="start"/>'+
        //             '<field name="allday"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return 120;
        //         },
        //     },
        //     translateParameters: { // Avoid issues due to localization formats
        //         time_format: "%I:%M:%S",
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === "create") {
        //             assert.deepEqual(args.kwargs.context, {
        //                 "default_start": "2016-12-13 06:00:00",
        //                 "default_stop": "2016-12-13 08:00:00",
        //                 "default_allday": null
        //             },
        //             "should send the context to create events");
        //         }
        //         return this._super(route, args);
        //     },
        // }, {positionalClicks: true});

        // var top = calendar.$('.fc-axis:contains(8am)').offset().top + 5;
        // var left = calendar.$('.fc-day:eq(2)').offset().left + 5;

        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }

        // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mousemove");

        // assert.strictEqual(calendar.$('.fc-content .fc-time').text(), "8:00 - 10:00",
        //     "should display the time in the calendar sticker");

        // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mouseup");
        // await testUtils.nextTick();
        // testUtils.fields.editInput($('.modal input:first'), 'new event');
        // await testUtils.dom.click($('.modal button.btn:contains(Create)'));
        // var $newevent = calendar.$('.fc-event:contains(new event)');

        // assert.strictEqual($newevent.find('.o_event_title').text(), "new event",
        //     "should display the new event with title");

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

        // // delete record

        // await testUtils.dom.click($newevent);
        // await testUtils.dom.click(calendar.$('.o_cw_popover .o_cw_popover_delete'));
        // await testUtils.dom.click($('.modal button.btn-primary:contains(Ok)'));
        // assert.containsNone(calendar, '.fc-content', "should delete the record");

        // calendar.destroy();
    });

    QUnit.todo("fetch event when being in timezone", async (assert) => {
        assert.ok(false);

        // assert.expect(3);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'mode="week" >'+
        //             '<field name="name"/>'+
        //             '<field name="start"/>'+
        //             '<field name="allday"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return 660;
        //         },
        //     },

        //     mockRPC: async function (route, args) {
        //         if (args.method === 'search_read' && args.model === 'event') {
        //             assert.deepEqual(args.kwargs.domain, [
        //                 ["start", "<=", "2016-12-17 12:59:59"], // in UTC. which is 2016-12-17 23:59:59 in TZ Sydney 11 hours later
        //                 ["stop", ">=", "2016-12-10 13:00:00"]   // in UTC. which is 2016-12-11 00:00:00 in TZ Sydney 11 hours later
        //             ], 'The domain should contain the right range');
        //         }
        //         return this._super(route, args);
        //     },
        // });

        // assert.strictEqual(calendar.$('.fc-day-header:first').text(), 'Sun 11',
        //     'The calendar start date should be 2016-12-11');
        // assert.strictEqual(calendar.$('.fc-day-header:last()').text(), 'Sat 17',
        //     'The calendar start date should be 2016-12-17');

        // calendar.destroy();
    });

    QUnit.todo(
        "create event with timezone in week mode with formViewDialog American locale",
        async (assert) => {
            assert.ok(false);

            // assert.expect(8);

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

            // this.data.event.records = [];
            // this.data.event.onchanges = {
            //     allday: function (obj) {
            //         if (obj.allday) {
            //             obj.start_date = obj.start && obj.start.split(' ')[0] || obj.start_date;
            //             obj.stop_date = obj.stop && obj.stop.split(' ')[0] || obj.stop_date || obj.start_date;
            //         } else {
            //             obj.start = obj.start_date && (obj.start_date + ' 00:00:00') || obj.start;
            //             obj.stop = obj.stop_date && (obj.stop_date + ' 00:00:00') || obj.stop || obj.start;
            //         }
            //     }
            // };

            // var calendar = await createCalendarView({
            //     View: CalendarView,
            //     model: 'event',
            //     data: this.data,
            //     arch:
            //     '<calendar class="o_calendar_test" '+
            //         'event_open_popup="true" '+
            //         'date_start="start" '+
            //         'date_stop="stop" '+
            //         'all_day="allday" '+
            //         'mode="week">'+
            //             '<field name="name"/>'+
            //     '</calendar>',
            //     archs: archs,
            //     viewOptions: {
            //         initialDate: initialDate,
            //     },
            //     session: {
            //         getTZOffset: function () {
            //             return 120;
            //         },
            //     },
            //     translateParameters: { // Avoid issues due to localization formats
            //         time_format: "%I:%M:%S",
            //     },
            //     mockRPC: function (route, args) {
            //         if (args.method === "create") {
            //             assert.deepEqual(args.kwargs.context, {
            //                 "default_name": "new event",
            //                 "default_start": "2016-12-13 06:00:00",
            //                 "default_stop": "2016-12-13 08:00:00",
            //                 "default_allday": null
            //             },
            //             "should send the context to create events");
            //         }
            //         if (args.method === "write") {
            //             assert.deepEqual(args.args[1], expectedEvent,
            //                 "should move the event");
            //         }
            //         return this._super(route, args);
            //     },
            // }, {positionalClicks: true});

            // var top = calendar.$('.fc-axis:contains(8am)').offset().top + 5;
            // var left = calendar.$('.fc-day:eq(2)').offset().left + 5;

            // try {
            //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // } catch (e) {
            //     calendar.destroy();
            //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
            // }
            // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top + 60, "mouseup");
            // await testUtils.nextTick();
            // testUtils.fields.editInput($('.modal input:first'), 'new event');
            // await testUtils.dom.click($('.modal button.btn:contains(Edit)'));

            // assert.strictEqual($('.o_field_widget[name="start"] input').val(), "12/13/2016 08:00:00",
            //     "should display the datetime");

            // await testUtils.dom.click($('.modal-lg .o_field_boolean[name="allday"] input'));

            // assert.strictEqual($('.o_field_widget[name="start_date"] input').val(), "12/13/2016",
            //     "should display the date");

            // await testUtils.dom.click($('.modal-lg .o_field_boolean[name="allday"] input'));

            // assert.strictEqual($('.o_field_widget[name="start"] input').val(), "12/13/2016 02:00:00",
            //     "should display the datetime from the date with the timezone");

            // // use datepicker to enter a date: 12/13/2016 08:00:00
            // testUtils.dom.openDatepicker($('.o_field_widget[name="start"].o_datepicker'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker .timepicker-hour'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker-hours td.hour:contains(08)'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]'));

            // // use datepicker to enter a date: 12/13/2016 10:00:00
            // testUtils.dom.openDatepicker($('.o_field_widget[name="stop"].o_datepicker'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="togglePicker"]'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker .timepicker-hour'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .timepicker-hours td.hour:contains(10)'));
            // await testUtils.dom.click($('.bootstrap-datetimepicker-widget .picker-switch a[data-action="close"]'));

            // await testUtils.dom.click($('.modal-lg button.btn:contains(Save)'));
            // var $newevent = calendar.$('.fc-event:contains(new event)');

            // assert.strictEqual($newevent.find('.o_event_title').text(), "new event",
            //     "should display the new event with title");

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

            // var pos = calendar.$('.fc-content').offset();
            // left = pos.left + 5;
            // top = pos.top + 5;

            // // Mode this event to another day
            // var expectedEvent = {
            // "allday": false,
            // "start": "2016-12-12 06:00:00",
            // "stop": "2016-12-12 08:00:00"
            // };
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // left = calendar.$('.fc-day:eq(1)').offset().left + 15;
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mouseup");
            // await testUtils.nextTick();

            // // Move to "All day"
            // expectedEvent = {
            // "allday": true,
            // "start": "2016-12-12 00:00:00",
            // "stop": "2016-12-12 00:00:00"
            // };
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
            // top = calendar.$('.fc-day:eq(1)').offset().top + 15;
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousemove");
            // testUtils.dom.triggerPositionalMouseEvent(left, top, "mouseup");
            // await testUtils.nextTick();

            // calendar.destroy();
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

    QUnit.todo("create all day event in week mode", async (assert) => {
        assert.ok(false);

        // assert.expect(3);

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

        // this.data.event.records = [];

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week">'+
        //             '<field name="name"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return 120;
        //         },
        //     },
        // }, {positionalClicks: true});

        // var pos = calendar.$('.fc-bg td:eq(4)').offset();
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // pos = calendar.$('.fc-bg td:eq(5)').offset();
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mouseup");
        // await testUtils.nextTick();

        // testUtils.fields.editInput($('.modal input:first'), 'new event');
        // await testUtils.dom.click($('.modal button.btn:contains(Create)'));
        // var $newevent = calendar.$('.fc-event:contains(new event)');

        // assert.strictEqual($newevent.text().replace(/[\s\n\r]+/g, ''), "newevent",
        //     "should display the new event with time and title");
        // assert.hasAttrValue($newevent.parent(), 'colspan', "2",
        //     "should appear over two days.");

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

        // calendar.destroy();
    });

    QUnit.todo("create event with default context (no quickCreate)", async (assert) => {
        assert.ok(false);

        // assert.expect(3);

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

        // this.data.event.records = [];

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

        // var pos = calendar.$('.fc-bg td:eq(4)').offset();
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(pos.left + 15, pos.top + 15, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // pos = calendar.$('.fc-bg td:eq(5)').offset();
        // testUtils.dom.triggerPositionalMouseEvent(pos.left + 15, pos.top + 15, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(pos.left + 15, pos.top + 15, "mouseup");
        // assert.verifySteps(['do_action']);

        // calendar.destroy();
    });

    QUnit.todo("create all day event in week mode (no quickCreate)", async (assert) => {
        assert.ok(false);

        // assert.expect(1);

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

        // this.data.event.records = [];

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

        // var pos = calendar.$('.fc-bg td:eq(4)').offset();
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // pos = calendar.$('.fc-bg td:eq(5)').offset();
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mouseup");

        // calendar.destroy();
    });

    QUnit.todo("create event in month mode", async (assert) => {
        assert.ok(false);

        // assert.expect(4);

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

        // this.data.event.records = [];

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'mode="month">'+
        //             '<field name="name"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return 120;
        //         },
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === "create") {
        //             assert.deepEqual(args.args[0], {
        //                 "name": "new event",
        //                 "start": "2016-12-14 05:00:00",
        //                 "stop": "2016-12-15 17:00:00",
        //             },
        //             "should send the correct data to create events");
        //         }
        //         return this._super(route, args);
        //     },
        // }, {positionalClicks: true});

        // var pos = calendar.$('.fc-bg td:eq(17)').offset();
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // pos = calendar.$('.fc-bg td:eq(18)').offset();
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(pos.left+15, pos.top+15, "mouseup");
        // await testUtils.nextTick();

        // testUtils.fields.editInput($('.modal input:first'), 'new event');
        // await testUtils.dom.click($('.modal button.btn:contains(Create)'));
        // var $newevent = calendar.$('.fc-event:contains(new event)');

        // assert.strictEqual($newevent.text().replace(/[\s\n\r]+/g, ''), "newevent",
        //     "should display the new event with time and title");
        // assert.hasAttrValue($newevent.parent(), 'colspan', "2",
        //     "should appear over two days.");

        // assert.deepEqual($newevent[0].fcSeg.eventRange.def.extendedProps.record, {
        //     display_name: "new event",
        //     start: fieldUtils.parse.datetime("2016-12-14 05:00:00", this.data.event.fields.start, {isUTC: true}),
        //     stop: fieldUtils.parse.datetime("2016-12-15 17:00:00", this.data.event.fields.stop, {isUTC: true}),
        //     name: "new event",
        //     id: 1
        // }, "the new record should have the utc datetime (quickCreate)");

        // calendar.destroy();
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

        // assert.expect(5);

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

        // this.data.event.fields.partner_ids.type = 'many2many';
        // this.data.event.records[0].partner_ids = [1,2,3,4,5];
        // this.data.partner.records.push({id: 5, display_name: "partner 5", image: 'EEE'});

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday"> '+
        //             '<field name="partner_ids" widget="many2many_tags_avatar" avatar_field="image" write_model="filter_partner" write_field="partner_id"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });

        // assert.containsN(calendar, '.o_calendar_filter_items .o_cw_filter_avatar', 3,
        //     "should have 3 avatars in the side bar");

        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=all] input'));

        // // Event 1
        // await testUtils.dom.click(calendar.$('.fc-event:first'));
        // assert.ok(calendar.$('.o_cw_popover').length, "should open a popover clicking on event");
        // assert.strictEqual(calendar.$('.o_cw_popover').find('img').length, 1, "should have 1 avatar");

        // // Event 2
        // await testUtils.dom.click(calendar.$('.fc-event:eq(1)'));
        // assert.ok(calendar.$('.o_cw_popover').length, "should open a popover clicking on event");
        // assert.strictEqual(calendar.$('.o_cw_popover').find('img').length, 5, "should have 5 avatar");

        // calendar.destroy();
    });

    QUnit.todo("open form view", async (assert) => {
        assert.ok(false);

        // assert.expect(3);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'string="Events" ' +
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === "get_formview_id") {
        //             return Promise.resolve('A view');
        //         }
        //         return this._super(route, args);
        //     },
        // });

        // // click on an existing event to open the form view

        // testUtils.mock.intercept(calendar, 'do_action', function (event) {
        //     assert.deepEqual(event.data.action,
        //         {
        //             type: "ir.actions.act_window",
        //             res_id: 4,
        //             res_model: "event",
        //             views: [['A view', "form"]],
        //             target: "current",
        //             context: {}
        //         },
        //         "should open the form view");
        // });
        // await testUtils.dom.click(calendar.$('.fc-event:contains(event 4) .fc-content'));
        // await testUtils.dom.click(calendar.$('.o_cw_popover .o_cw_popover_edit'));

        // // create a new event and edit it

        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(4) .fc-day:eq(2)');
        // testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();
        // testUtils.fields.editInput($('.modal-body input:first'), 'coucou');

        // testUtils.mock.intercept(calendar, 'do_action', function (event) {
        //     assert.deepEqual(event.data.action,
        //         {
        //             type: "ir.actions.act_window",
        //             res_model: "event",
        //             views: [[false, "form"]],
        //             target: "current",
        //             context: {
        //                 "default_name": "coucou",
        //                 "default_start": "2016-12-27 00:00:00",
        //                 "default_stop": "2016-12-27 00:00:00",
        //                 "default_allday": true
        //             }
        //         },
        //         "should open the form view with the context default values");
        // });

        // testUtils.dom.click($('.modal button.btn:contains(Edit)'));

        // calendar.destroy();

        // assert.strictEqual($('#ui-datepicker-div:empty').length, 0, "should have a clean body");
    });

    QUnit.todo("create and edit event in month mode (all_day: false)", async (assert) => {
        assert.ok(false);

        // assert.expect(2);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'string="Events" ' +
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return -240;
        //         },
        //     },
        // });

        // // create a new event and edit it
        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(4) .fc-day:eq(2)');
        // testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();
        // await testUtils.fields.editInput($('.modal-body input:first'), 'coucou');

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

        // await testUtils.dom.click($('.modal button.btn:contains(Edit)'));

        // calendar.destroy();
        // assert.strictEqual($('#ui-datepicker-div:empty').length, 0, "should have a clean body");
    });

    QUnit.todo("show start time of single day event for month mode", async (assert) => {
        assert.ok(false);

        // assert.expect(4);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" ' +
        //         'string="Events" ' +
        //         'date_start="start" ' +
        //         'date_stop="stop" ' +
        //         'all_day="allday" ' +
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return -240;
        //         },
        //     },
        // });

        // assert.strictEqual(calendar.$('.fc-event:contains(event 2) .fc-content .fc-time').text(), "06:55",
        //     "should have a correct time 06:55 AM in month mode");
        // assert.strictEqual(calendar.$('.fc-event:contains(event 4) .fc-content .fc-time').text(), "",
        //     "should not display a time for all day event");
        // assert.strictEqual(calendar.$('.fc-event:contains(event 5) .fc-content .fc-time').text(), "",
        //     "should not display a time for multiple days event");
        // // switch to week mode
        // await testUtils.dom.click(calendar.$('.o_calendar_button_week'));
        // assert.strictEqual(calendar.$('.fc-event:contains(event 2) .fc-content .fc-time').text(), "",
        //     "should not show time in week mode as week mode already have time on y-axis");

        // calendar.destroy();
    });

    QUnit.todo("start time should not shown for date type field", async (assert) => {
        // assert.expect(1);

        assert.ok(false);

        serverData.models.event.fields.start.type = "date";
        // tz offset = -240

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

    QUnit.todo("start time should not shown in month mode if hide_time is true", async (assert) => {
        // assert.expect(1);

        assert.ok(false);
        // tz offset = -240

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

    QUnit.todo("readonly date_start field", async (assert) => {
        assert.ok(false);

        // assert.expect(4);

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

        // this.data.event.fields.start.readonly = true;

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'string="Events" ' +
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === "get_formview_id") {
        //             return Promise.resolve(false);
        //         }
        //         return this._super(route, args);
        //     },
        // });

        // assert.containsNone(calendar, '.fc-resizer', "should not have resize button");

        // // click on an existing event to open the form view

        // testUtils.mock.intercept(calendar, 'do_action', function (event) {
        //     assert.deepEqual(event.data.action,
        //         {
        //             type: "ir.actions.act_window",
        //             res_id: 4,
        //             res_model: "event",
        //             views: [[false, "form"]],
        //             target: "current",
        //             context: {}
        //         },
        //         "should open the form view");
        // });
        // await testUtils.dom.click(calendar.$('.fc-event:contains(event 4) .fc-content'));
        // await testUtils.dom.click(calendar.$('.o_cw_popover .o_cw_popover_edit'));

        // // create a new event and edit it

        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(4) .fc-day:eq(2)');
        // testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();
        // await testUtils.fields.editInput($('.modal-body input:first'), 'coucou');

        // testUtils.mock.intercept(calendar, 'do_action', function (event) {
        //     assert.deepEqual(event.data.action,
        //         {
        //             type: "ir.actions.act_window",
        //             res_model: "event",
        //             views: [[false, "form"]],
        //             target: "current",
        //             context: {
        //                 "default_name": "coucou",
        //                 "default_start": "2016-12-27 00:00:00",
        //                 "default_stop": "2016-12-27 00:00:00",
        //                 "default_allday": true
        //             }
        //         },
        //         "should open the form view with the context default values");
        // });

        // await testUtils.dom.click($('.modal button.btn:contains(Edit)'));

        // calendar.destroy();

        // assert.strictEqual($('#ui-datepicker-div:empty').length, 0, "should have a clean body");
    });

    QUnit.todo("check filters with filter_field specified", async (assert) => {
        assert.ok(false);

        // assert.expect(5);

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

        // const calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch: `
        //         <calendar class="o_calendar_test"
        //                 event_open_popup="true"
        //                 date_start="start"
        //                 date_stop="stop"
        //                 all_day="allday"
        //                 mode="week"
        //                 color="partner_id">
        //             <field name="partner_ids" write_model="filter_partner" write_field="partner_id" filter_field="partner_checked"/>
        //         </calendar>`,
        // });

        // assert.containsOnce(calendar, '.o_calendar_filter_item[data-id="2"] input:checked',
        //     "checkbox should be checked");
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-id="2"] input'));
        // assert.containsNone(calendar, '.o_calendar_filter_item[data-id="2"] input:checked',
        //     "checkbox should not be checked");
        // assert.strictEqual(this.data.filter_partner.records.find(r => r.id === 2).partner_checked, false,
        //     "the status of this filter should now be false");
        // await calendar.reload();
        // assert.containsNone(calendar, '.o_calendar_filter_item[data-id="2"] input:checked',
        //     "checkbox should not be checked after the reload");
        // assert.strictEqual(this.data.filter_partner.records.find(r => r.id === 2).partner_checked, false,
        //     "the status of this filter should still be false after the reload");
        // calendar.destroy();
    });

    QUnit.todo('"all" filter', async (assert) => {
        assert.ok(false);

        // assert.expect(8);

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

        // var interval = [
        //     ["start", "<=", "2016-12-17 23:59:59"],
        //     ["stop", ">=", "2016-12-11 00:00:00"],
        // ];

        // var domains = [
        //     interval.concat([["partner_ids", "in", []]]),
        //     interval.concat([["partner_ids", "in", [1]]]),
        //     interval.concat([["partner_ids", "in", [2,1]]]),
        //     interval,
        // ];

        // var i = 0;

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //     '</calendar>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === 'search_read' && args.model === 'event') {
        //             assert.deepEqual(args.kwargs.domain, domains[i]);
        //             i++;
        //         }
        //         return this._super.apply(this, arguments);
        //     },
        // });
        // // By default, no user is selected
        // assert.containsN(calendar, '.fc-event', 0,
        //     "should display 0 events on the week");

        // // Select the events only associated with partner 2
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-id=1] input'));
        // assert.containsN(calendar, '.fc-event', 4,
        //     "should display 4 events on the week");
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));
        // assert.containsN(calendar, '.fc-event', 9,
        //     "should display 9 events on the week");
        // // Click on the 'all' filter to reload all events
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=all] input'));
        // assert.containsN(calendar, '.fc-event', 9,
        //     "should display 9 events on the week");

        // calendar.destroy();
    });

    QUnit.todo("Add filters and specific color", async (assert) => {
        assert.ok(false);

        // assert.expect(6);

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

        // this.data.event.records.push(
        //     {id: 8, user_id: 4, partner_id: 1, name: "event 8", start: "2016-12-11 09:00:00", stop: "2016-12-11 10:00:00", allday: false, partner_ids: [1,2,3], event_type_id: 3, color: 4},
        //     {id: 9, user_id: 4, partner_id: 1, name: "event 9", start: "2016-12-11 19:00:00", stop: "2016-12-11 20:00:00", allday: false, partner_ids: [1,2,3], event_type_id: 1, color: 1},
        // );

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'color="color">'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //             '<field name="event_type_id" filters="1" color="color"/>'+
        //     '</calendar>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });
        // // By default no filter is selected. We check before continuing.
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));

        // assert.containsN(calendar, '.o_calendar_filter', 2, "should display 2 filters");

        // var $typeFilter =  calendar.$('.o_calendar_filter:has(span:contains(Event Type))');
        // assert.ok($typeFilter.length, "should display 'Event Type' filter");
        // assert.containsOnce($typeFilter, '#o_cw_filter_collapse_EventType', "Id should be equals to o_cw_filter_collapse_EventType for 'Event Type'");
        // assert.containsN($typeFilter, '.o_calendar_filter_item', 3, "should display 3 filter items for 'Event Type'");

        // assert.containsOnce($typeFilter, '.o_calendar_filter_item[data-value=3].o_cw_filter_color_4', "Filter for event type 3 must have the color 4");

        // assert.containsOnce(calendar, '.fc-event[data-event-id=8].o_calendar_color_4', "Event of event type 3 must have the color 4");

        // calendar.destroy();
    });

    QUnit.todo("create event with filters", async (assert) => {
        assert.ok(false);

        // assert.expect(7);

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

        // this.data.event.fields.user_id.default = 5;
        // this.data.event.fields.partner_id.default = 3;
        // this.data.user.records.push({id: 5, display_name: "user 5", partner_id: 3});

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //             '<field name="partner_id" filters="1" invisible="1"/>'+
        //     '</calendar>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // }, {positionalClicks: true});

        // // By default only
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // assert.containsN(calendar, '.o_calendar_filter_item', 5, "should display 5 filter items");
        // assert.containsN(calendar, '.fc-event', 4, "should display 4 events");

        // // quick create a record
        // var left = calendar.$('.fc-bg td:eq(4)').offset().left+15;
        // var top = calendar.$('.fc-slats tr:eq(12) td:first').offset().top+15;
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mouseup");
        // await testUtils.nextTick();

        // await testUtils.fields.editInput($('.modal-body input:first'), 'coucou');
        // await testUtils.dom.click($('.modal-footer button.btn:contains(Create)'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 6, "should add the missing filter (active)");
        // assert.containsN(calendar, '.fc-event', 5, "should display the created item");
        // await testUtils.nextTick();

        // // change default value for quick create an hide record
        // this.data.event.fields.user_id.default = 4;
        // this.data.event.fields.partner_id.default = 4;
        // // Disable our filter to create a record without displaying it
        //  await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=4] input'));
        // // quick create and other record
        // left = calendar.$('.fc-bg td:eq(3)').offset().left+15;
        // top = calendar.$('.fc-slats tr:eq(12) td:first').offset().top+15;
        // testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mouseup");
        // await testUtils.nextTick();

        // testUtils.fields.editInput($('.modal-body input:first'), 'coucou 2');
        // await testUtils.dom.click($('.modal-footer button.btn:contains(Create)'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 6, "should have the same filters");
        // assert.containsN(calendar, '.fc-event', 4, "should not display the created item");

        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=4] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));

        // assert.containsN(calendar, '.fc-event', 11, "should display all records");

        // calendar.destroy();
    });

    QUnit.todo("create event with filters (no quickCreate)", async (assert) => {
        assert.ok(false);

        // assert.expect(4);

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

        // this.data.event.fields.user_id.default = 5;
        // this.data.event.fields.partner_id.default = 3;
        // this.data.user.records.push({
        //     id: 5,
        //     display_name: "user 5",
        //     partner_id: 3
        // });

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //             '<field name="partner_id" filters="1" invisible="1"/>'+
        //     '</calendar>',
        //     archs: {
        //         "event,false,form":
        //             '<form>'+
        //                 '<group>'+
        //                     '<field name="name"/>'+
        //                     '<field name="start"/>'+
        //                     '<field name="stop"/>'+
        //                     '<field name="user_id"/>'+
        //                     '<field name="partner_id" invisible="1"/>'+
        //                 '</group>'+
        //             '</form>',
        //     },
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // }, {positionalClicks: true});
        // // dislay all attendee calendars
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=4] input'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 5, "should display 5 filter items");
        // assert.containsN(calendar, '.fc-event', 3, "should display 3 events");
        // await testUtils.nextTick();

        // // quick create a record
        // var left = calendar.$('.fc-bg td:eq(4)').offset().left+15;
        // var top = calendar.$('.fc-slats tr:eq(12) td:first').offset().top+15;
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test fails to simulate a click in the screen. Your screen is probably too small or your dev tools is open.');
        // }
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mousemove");
        // testUtils.dom.triggerPositionalMouseEvent(left, top + 200, "mouseup");
        // await testUtils.nextTick();

        // await testUtils.fields.editInput($('.modal-body input:first'), 'coucou');

        // await testUtils.dom.click($('.modal-footer button.btn:contains(Edit)'));
        // await testUtils.dom.click($('.modal-footer button.btn:contains(Save)'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 6, "should add the missing filter (active)");
        // assert.containsN(calendar, '.fc-event', 4, "should display the created item");

        // calendar.destroy();
    });

    QUnit.todo("Update event with filters", async (assert) => {
        assert.ok(false);

        // assert.expect(12);

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

        // var records = this.data.user.records;
        // records.push({
        //     id: 5,
        //     display_name: "user 5",
        //     partner_id: 3
        // });

        // this.data.event.onchanges = {
        //     user_id: function (obj) {
        //         obj.partner_id = _.findWhere(records, {id:obj.user_id}).partner_id;
        //     }
        // };

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //             '<field name="partner_id" filters="1" invisible="1"/>'+
        //     '</calendar>',
        //     archs: {
        //         "event,false,form":
        //             '<form>'+
        //                 '<group>'+
        //                     '<field name="name"/>'+
        //                     '<field name="start"/>'+
        //                     '<field name="stop"/>'+
        //                     '<field name="user_id"/>'+
        //                     '<field name="partner_ids" widget="many2many_tags"/>'+
        //                 '</group>'+
        //             '</form>',
        //     },
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });
        // // select needed partner filters
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=4] input'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 5, "should display 5 filter items");
        // assert.containsN(calendar, '.fc-event', 3, "should display 3 events");

        // await testUtils.dom.click(calendar.$('.fc-event:contains(event 2) .fc-content'));
        // assert.ok(calendar.$('.o_cw_popover').length, "should open a popover clicking on event");
        // await testUtils.dom.click(calendar.$('.o_cw_popover .o_cw_popover_edit'));
        // assert.strictEqual($('.modal .modal-title').text(), 'Open: event 2', "dialog should have a valid title");
        // await testUtils.dom.click($('.modal .o_field_widget[name="user_id"] input'));
        // await testUtils.dom.click($('.ui-menu-item a:contains(user 5)').trigger('mouseenter'));
        // await testUtils.dom.click($('.modal button.btn:contains(Save)'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 6, "should add the missing filter (active)");
        // assert.containsN(calendar, '.fc-event', 3, "should display the updated item");

        // // test the behavior of the 'select all' input checkbox
        // assert.containsN(calendar, '.o_calendar_filter_item input:checked', 3, "should display 3 true checkbox");
        // assert.containsN(calendar, '.o_calendar_filter_item input:not(:checked)', 3, "should display 3 false checkbox");
        // // Click to select all users
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_items_checkall:eq(1) input'));
        // // should contains 4 events
        // assert.containsN(calendar, '.fc-event', 4, "should display the updated events");
        // // Should have 4 checked boxes
        // assert.containsN(calendar, '.o_calendar_filter_item input:checked', 4, "should display 4 true checkbox");
        // // unselect all user
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_items_checkall:eq(1) input'));
        // assert.containsN(calendar, '.fc-event', 0, "should not display any event");
        // assert.containsN(calendar, '.o_calendar_filter_item input:checked', 1, "should display 1 true checkbox");
        // calendar.destroy();
    });

    QUnit.todo("change pager with filters", async (assert) => {
        assert.ok(false);

        // assert.expect(3);

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

        // this.data.user.records.push({
        //     id: 5,
        //     display_name: "user 5",
        //     partner_id: 3
        // });
        // this.data.event.records.push({
        //     id: 8,
        //     user_id: 5,
        //     partner_id: 3,
        //     name: "event 8",
        //     start: "2016-12-06 04:00:00",
        //     stop: "2016-12-06 08:00:00",
        //     allday: false,
        //     partner_ids: [1,2,3],
        //     type: 1
        // }, {
        //     id: 9,
        //     user_id: session.uid,
        //     partner_id: 1,
        //     name: "event 9",
        //     start: "2016-12-07 04:00:00",
        //     stop: "2016-12-07 08:00:00",
        //     allday: false,
        //     partner_ids: [1,2,3],
        //     type: 1
        // },{
        //     id: 10,
        //     user_id: 4,
        //     partner_id: 4,
        //     name: "event 10",
        //     start: "2016-12-08 04:00:00",
        //     stop: "2016-12-08 08:00:00",
        //     allday: false,
        //     partner_ids: [1,2,3],
        //     type: 1
        // });

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //             '<field name="partner_id" filters="1" invisible="1"/>'+
        //     '</calendar>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });
        // // select filter for partner 1, 2 and 4
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input')[0]);
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=4] input'));

        // await testUtils.dom.click($('.o_calendar_button_prev'));

        // assert.containsN(calendar, '.o_calendar_filter_item', 6, "should display 6 filter items");
        // assert.containsN(calendar, '.fc-event', 2, "should display 2 events");
        // assert.strictEqual(calendar.$('.fc-event .o_event_title').text().replace(/\s/g, ''), "event8event9",
        //     "should display 2 events");

        // calendar.destroy();
    });

    QUnit.todo("ensure events are still shown if filters give an empty domain", async (assert) => {
        assert.ok(false);

        // assert.expect(2);

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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch: '<calendar mode="week" date_start="start">' +
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>' +
        //         '</calendar>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));
        // assert.containsN(calendar, '.fc-event', 5,
        //     "should display 5 events");
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=all] input[type=checkbox]'));
        // assert.containsN(calendar, '.fc-event', 5,
        //     "should display 5 events");
        // calendar.destroy();
    });

    QUnit.todo("events starting at midnight", async (assert) => {
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

        // assert.expect(3);

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch: '<calendar mode="week" date_start="start"/>',
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     translateParameters: { // Avoid issues due to localization formats
        //         time_format: "%H:%M:%S",
        //     },
        // }, {positionalClicks: true});

        // // Reset the scroll to 0 as we want to create an event from midnight
        // assert.ok(calendar.$('.fc-scroller')[0].scrollTop > 0,
        //     "should scroll to 6:00 by default (this is true at least for resolutions up to 1900x1600)");
        // calendar.$('.fc-scroller')[0].scrollTop = 0;

        // // Click on Tuesday 12am
        // var top = calendar.$('.fc-axis:contains(0:00)').offset().top + 5;
        // var left = calendar.$('.fc-day:eq(2)').offset().left + 5;
        // try {
        //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mousedown");
        //     testUtils.dom.triggerPositionalMouseEvent(left, top, "mouseup");
        //     await testUtils.nextTick();
        // } catch (e) {
        //     calendar.destroy();
        //     throw new Error('The test failed to simulate a click on the screen.' +
        //         'Your screen is probably too small or your dev tools are open.');
        // }
        // assert.ok($('.modal-dialog.modal-sm').length,
        //     "should open the quick create dialog");

        // // Creating the event
        // testUtils.fields.editInput($('.modal-body input:first'), 'new event in quick create');
        // await testUtils.dom.click($('.modal-footer button.btn:contains(Create)'));
        // assert.strictEqual(calendar.$('.fc-event:contains(new event in quick create)').length, 1,
        //     "should display the new record after quick create dialog");

        // calendar.destroy();
    });

    QUnit.todo("set event as all day when field is date", async (assert) => {
        assert.ok(false);

        // assert.expect(2);

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

        // this.data.event.records[0].start_date = "2016-12-14";

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start_date" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     session: {
        //         getTZOffset: function () {
        //             return -480;
        //         }
        //     },
        // });
        // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=1] input'));
        // assert.containsOnce(calendar, '.fc-day-grid .fc-event-container',
        //     "should be one event in the all day row");
        // assert.strictEqual(moment(calendar.model.data.data[0].r_start).date(), 14,
        //     "the date should be 14");
        // calendar.destroy();
    });

    QUnit.todo(
        "set event as all day when field is date (without all_day mapping)",
        async (assert) => {
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

            // this.data.event.records[0].start_date = "2016-12-14";

            // var calendar = await createCalendarView({
            //     View: CalendarView,
            //     model: 'event',
            //     data: this.data,
            //     arch: `<calendar date_start="start_date" mode="week"></calendar>`,
            //     archs: archs,
            //     viewOptions: {
            //         initialDate: initialDate,
            //     },
            // });
            // assert.containsOnce(calendar, '.fc-day-grid .fc-event-container',
            //     "should be one event in the all day row");
            // calendar.destroy();
        }
    );

    QUnit.todo("quickcreate avoid double event creation", async (assert) => {
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
        // var createCount = 0;
        // var prom = testUtils.makeTestPromise();
        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch: '<calendar class="o_calendar_test" '+
        //         'string="Events" ' +
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     mockRPC: function (route, args) {
        //         var result = this._super(route, args);
        //         if (args.method === "create") {
        //             createCount++;
        //             return prom.then(_.constant(result));
        //         }
        //         return result;
        //     },
        // });

        // // create a new event
        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(2) .fc-day:eq(2)');
        // testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();

        // var $input = $('.modal input:first');
        // await testUtils.fields.editInput($input, 'new event in quick create');
        // // Simulate ENTER pressed on Create button (after a TAB)
        // $input.trigger($.Event('keyup', {
        //     which: $.ui.keyCode.ENTER,
        //     keyCode: $.ui.keyCode.ENTER,
        // }));
        // await testUtils.nextTick();
        // await testUtils.dom.click($('.modal-footer button:first'));
        // prom.resolve();
        // await testUtils.nextTick();
        // assert.strictEqual(createCount, 1,
        //     "should create only one event");

        // calendar.destroy();
    });

    QUnit.todo("check if the view destroys all widgets and instances", async (assert) => {
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

        // assert.expect(2);

        // var instanceNumber = 0;
        // testUtils.mock.patch(mixins.ParentedMixin, {
        //     init: function () {
        //         instanceNumber++;
        //         return this._super.apply(this, arguments);
        //     },
        //     destroy: function () {
        //         if (!this.isDestroyed()) {
        //             instanceNumber--;
        //         }
        //         return this._super.apply(this, arguments);
        //     }
        // });

        // var params = {
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'event_open_popup="true" '+
        //         'date_start="start_date" '+
        //         'all_day="allday" '+
        //         'mode="week" '+
        //         'attendee="partner_ids" '+
        //         'color="partner_id">'+
        //             '<filter name="user_id" avatar_field="image"/>'+
        //             '<field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // };

        // var calendar = await createCalendarView(params);
        // assert.ok(instanceNumber > 0);

        // calendar.destroy();
        // assert.strictEqual(instanceNumber, 0);

        // testUtils.mock.unpatch(mixins.ParentedMixin);
    });

    QUnit.todo("create an event (async dialog) [REQUIRE FOCUS]", async (assert) => {
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

        // assert.expect(3);

        // var prom = testUtils.makeTestPromise();
        // testUtils.mock.patch(Dialog, {
        //     open: function () {
        //         var _super = this._super.bind(this);
        //         prom.then(_super);
        //         return this;
        //     },
        // });
        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar class="o_calendar_test" '+
        //         'string="Events" ' +
        //         'event_open_popup="true" '+
        //         'date_start="start" '+
        //         'date_stop="stop" '+
        //         'all_day="allday" '+
        //         'mode="month"/>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        // });

        // // create an event
        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(2) .fc-day:eq(2)');
        // testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();

        // assert.strictEqual($('.modal').length, 0,
        //     "should not have opened the dialog yet");

        // prom.resolve();
        // await testUtils.nextTick();

        // assert.strictEqual($('.modal').length, 1,
        //     "should have opened the dialog");
        // assert.strictEqual($('.modal input')[0], document.activeElement,
        //     "should focus the input in the dialog");

        // calendar.destroy();
        // testUtils.mock.unpatch(Dialog);
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

    QUnit.todo("timezone does not affect drag and drop", async (assert) => {
        assert.expect(10);

        // patchTimeZone(-2400);

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

    QUnit.todo("timzeone does not affect calendar with date field", async (assert) => {
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

        // // Move event to another day (on 27 november)
        // await testUtils.dom.dragAndDrop(
        //     calendar.$('.fc-event').first(),
        //     calendar.$('.fc-day-top').first()
        // );
        // await testUtils.nextTick();
        // assert.verifySteps(["2016-11-27 00:00:00"]);
        // await testUtils.dom.click(calendar.$('.fc-event:contains(An event)'));
        // assert.ok(calendar.$('.o_cw_popover').length, "should open a popover clicking on event");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_field_date').text(), '11/27/2016', "should have correct start date");

        // // Move event to last day (on 7 january)
        // await testUtils.dom.dragAndDrop(
        //     calendar.$('.fc-event').first(),
        //     calendar.$('.fc-day-top').last()
        // );
        // await testUtils.nextTick();
        // assert.verifySteps(["2017-01-07 00:00:00"]);
        // await testUtils.dom.click(calendar.$('.fc-event:contains(An event)'));
        // assert.ok(calendar.$('.o_cw_popover').length, "should open a popover clicking on event");
        // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_field_date').text(), '01/07/2017', "should have correct start date");
        // calendar.destroy();
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

    QUnit.test("drag and drop on month mode with all_day mapping", async (assert) => {
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

    QUnit.todo("drag and drop on month mode with date_start and date_delay", async (assert) => {
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

        // var calendar = await createCalendarView({
        //     View: CalendarView,
        //     model: 'event',
        //     data: this.data,
        //     arch:
        //     '<calendar date_start="start" date_delay="delay" mode="month">'+
        //         '<field name="name"/>'+
        //         '<field name="start"/>'+
        //         '<field name="delay"/>'+
        //     '</calendar>',
        //     archs: archs,
        //     viewOptions: {
        //         initialDate: initialDate,
        //     },
        //     mockRPC: function (route, args) {
        //         if (args.method === "write") {
        //             // delay should not be written at drag and drop
        //             assert.equal(args.args[1].delay, undefined)
        //         }
        //         return this._super(route, args);
        //     },
        // });

        // // Create event (on 20 december)
        // var $cell = calendar.$('.fc-day-grid .fc-row:eq(3) .fc-day:eq(2)');
        // await testUtils.dom.triggerMouseEvent($cell, "mousedown");
        // await testUtils.dom.triggerMouseEvent($cell, "mouseup");
        // await testUtils.nextTick();
        // var $input = $('.modal-body input:first');
        // await testUtils.fields.editInput($input, "An event");
        // await testUtils.dom.click($('.modal button.btn:contains(Create)'));
        // await testUtils.nextTick();

        // // Move event to another day (on 27 november)
        // await testUtils.dom.dragAndDrop(
        //     calendar.$('.fc-event').first(),
        //     calendar.$('.fc-day-top').first()
        // );
        // await testUtils.nextTick();

        // calendar.destroy();
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

    QUnit.todo("correctly display year view", async (assert) => {
        assert.expect(28);

        const calendar = await makeView({
            type: "wowl_calendar",
            resModel: "event",
            serverData,
            arch: `
                <calendar
                    create="0"
                    event_open_popup="1"
                    date_start="start"
                    date_stop="stop"
                    all_day="allday"
                    mode="year"
                    color="partner_id"
                >
                    <field name="partner_ids" write_model="filter_partner" write_field="partner_id"/>
                    <field name="partner_id" filters="1" invisible="1"/>
                    <field name="is_hatched" invisible="1" />
                </calendar>
            `,
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

        assert.containsN(
            calendar.el,
            ".o_calendar_hatched",
            3,
            "There should be 3 events that are hatched"
        );

        // assert.notOk(calendar.el.querySelector('.fc-day-top[data-date="2016-11-17"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-11-17');
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.ok(calendar.el.querySelector('.fc-day-top[data-date="2016-11-16"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-11-16');
        // assert.containsOnce(calendar, '.o_cw_popover');
        // let popoverText = calendar.el.querySelector('.o_cw_popover')
        //     .textContent.replace(/\s{2,}/g, ' ').trim();
        // assert.strictEqual(popoverText, 'November 14-16, 2016 event 7');
        // await testUtils.dom.click(calendar.el.querySelector('.o_cw_popover_close'));
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.ok(calendar.el.querySelector('.fc-day-top[data-date="2016-11-14"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-11-14');
        // assert.containsOnce(calendar, '.o_cw_popover');
        // popoverText = calendar.el.querySelector('.o_cw_popover')
        //     .textContent.replace(/\s{2,}/g, ' ').trim();
        // assert.strictEqual(popoverText, 'November 14-16, 2016 event 7');
        // await testUtils.dom.click(calendar.el.querySelector('.o_cw_popover_close'));
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.notOk(calendar.el.querySelector('.fc-day-top[data-date="2016-11-13"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-11-13');
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.notOk(calendar.el.querySelector('.fc-day-top[data-date="2016-12-10"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-12-10');
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.ok(calendar.el.querySelector('.fc-day-top[data-date="2016-12-12"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-12-12');
        // assert.containsOnce(calendar, '.o_cw_popover');
        // popoverText = calendar.el.querySelector('.o_cw_popover')
        //     .textContent.replace(/\s{2,}/g, ' ').trim();
        // assert.strictEqual(popoverText, 'December 12, 2016 10:55 event 2 15:55 event 3');
        // await testUtils.dom.click(calendar.el.querySelector('.o_cw_popover_close'));
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.ok(calendar.el.querySelector('.fc-day-top[data-date="2016-12-14"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-12-14');
        // assert.containsOnce(calendar, '.o_cw_popover');
        // popoverText = calendar.el.querySelector('.o_cw_popover')
        //     .textContent.replace(/\s{2,}/g, ' ').trim();
        // assert.strictEqual(popoverText,
        //     'December 14, 2016 event 4 December 13-20, 2016 event 5');
        // await testUtils.dom.click(calendar.el.querySelector('.o_cw_popover_close'));
        // assert.containsNone(calendar, '.o_cw_popover');

        // assert.notOk(calendar.el.querySelector('.fc-day-top[data-date="2016-12-21"]')
        //     .classList.contains('fc-has-event'));
        // await clickDate('2016-12-21');
        // assert.containsNone(calendar, '.o_cw_popover');

        // calendar.destroy();
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
