/** @odoo-module **/

import { click, getFixture, nextTick, patchDate } from "../../helpers/utils";
import {
  changeScale,
  findDatePickerCurrentDayEl,
  findDatePickerDayEl,
  makeView,
  select,
} from "./calendar_test_helpers";

import { makeTestServiceRegistry, makeTestViewRegistry } from "../../helpers/mock_registries";
import { findItem } from "../../helpers/dom";
import { makeFakeLocalizationService, makeFakeUserService } from "../../helpers/mock_services";
import { registerCleanup } from "../../helpers/cleanup";
import { mainComponentRegistry } from "../../../src/webclient/main_component_registry";

const uid = -1;
let testConfig;
let popoverManager;

QUnit.module("Views", (hooks) => {
  hooks.beforeEach(async () => {
    patchDate(2016, 11, 12, 8, 0, 0);

    const viewRegistry = makeTestViewRegistry();
    const serviceRegistry = makeTestServiceRegistry();

    const userService = makeFakeUserService({ userId: uid });
    serviceRegistry.add("user", userService, { force: true });

    const serverData = {
      models: {
        event: {
          fields: {
            id: { string: "ID", type: "integer" },
            user_id: { string: "user", type: "many2one", relation: "user", default: uid },
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
            event_type_id: { string: "Event Type", type: "many2one", relation: "event_type" },
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
          },
          records: [
            { id: 1, user_id: uid, partner_id: 1 },
            { id: 2, user_id: uid, partner_id: 2 },
            { id: 3, user_id: 4, partner_id: 3 },
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
      },
      views: {
        "event,false,calendar": `<calendar date_start="start" />`,
      },
    };

    testConfig = { serverData, viewRegistry, serviceRegistry };

    const PopoverManager = mainComponentRegistry.get("PopoverManager");
    popoverManager = await owl.mount(PopoverManager, {
      target: getFixture(),
    });
    registerCleanup(() => {
      popoverManager.destroy();
    });
  });

  QUnit.module("CalendarView (wowl)");

  QUnit.skip("Simple calendar rendering", async function test(assert) {
    assert.expect(1);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            attendee="partner_ids"
            color="partner_id"
            date_start="start"
            date_stop="stop"
            event_open_popup="true"
            mode="month"
          >
            <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
            <field name="partner_id" filters="1" invisible="1" />
          </calendar>
        `,
      }
    );

    assert.containsOnce(calendar.el, ".o_calendar_view .fc-view-container");

    // test view scales
    assert.containsN(
      calendar,
      ".fc-event",
      0,
      "By default, only the events of the current user are displayed (0 in this case)"
    );

    await calendarUtils.changeScale(calendar, "day");

    // await calendarUtils.select(calendar.el, "week", "2016-12-12 01:00:00", "2016-12-16 23:00:00");

    assert.ok(
      calendar.$(".o_calendar_view").find(".fc-view-container").length,
      "should instance of fullcalendar"
    );

    // var $sidebar = calendar.$('.o_calendar_sidebar');

    // // test view scales
    // assert.containsN(calendar, '.fc-event', 0,
    //     "By default, only the events of the current user are displayed (0 in this case)");

    // // display all events
    // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=all] input'));
    // assert.containsN(calendar, '.fc-event', 9,
    //     "should display 9 events on the week (4 event + 5 days event)");
    // assert.containsN($sidebar, 'tr:has(.ui-state-active) td', 7,
    //     "week scale should highlight 7 days in mini calendar");

    // await testUtils.dom.click(calendar.$buttons.find('.o_calendar_button_day')); // display only one day
    // assert.containsN(calendar, '.fc-event', 2, "should display 2 events on the day");
    // assert.containsOnce($sidebar, '.o_selected_range',
    //     "should highlight the target day in mini calendar");

    // await testUtils.dom.click(calendar.$buttons.find('.o_calendar_button_month')); // display all the month

    // // We display the events or partner 1 2 and 4. Partner 2 has nothing and Event 6 is for partner 6 (not displayed)
    // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=all] input'));
    // await testUtils.dom.click(calendar.$('.o_calendar_filter .o_calendar_filter_item[data-value=1] input')[0]);
    // await testUtils.dom.click(calendar.$('.o_calendar_filter_item[data-value=2] input'));
    // assert.containsN(calendar, '.fc-event', 7,
    //     "should display 7 events on the month (5 events + 2 week event - 1 'event 6' is filtered + 1 'Undefined event')");
    // assert.containsN($sidebar, 'td a', 31,
    //     "month scale should highlight all days in mini calendar");

    // // test filters
    // assert.containsN($sidebar, '.o_calendar_filter', 2, "should display 2 filters");

    // var $typeFilter =  $sidebar.find('.o_calendar_filter:has(h5:contains(user))');
    // assert.ok($typeFilter.length, "should display 'user' filter");
    // assert.containsN($typeFilter, '.o_calendar_filter_item', 3, "should display 3 filter items for 'user'");

    // // filters which has no value should show with string "Undefined", should not have any user image and should show at the last
    // assert.strictEqual($typeFilter.find('.o_calendar_filter_item:last').data('value'), false, "filters having false value should be displayed at last in filter items");
    // assert.strictEqual($typeFilter.find('.o_calendar_filter_item:last .o_cw_filter_title').text(), "Undefined", "filters having false value should display 'Undefined' string");
    // assert.strictEqual($typeFilter.find('.o_calendar_filter_item:last label img').length, 0, "filters having false value should not have any user image");

    // var $attendeesFilter =  $sidebar.find('.o_calendar_filter:has(h5:contains(attendees))');
    // assert.ok($attendeesFilter.length, "should display 'attendees' filter");
    // assert.containsN($attendeesFilter, '.o_calendar_filter_item', 3, "should display 3 filter items for 'attendees' who use write_model (2 saved + Everything)");
    // assert.ok($attendeesFilter.find('.o_field_many2one').length, "should display one2many search bar for 'attendees' filter");

    // assert.containsN(calendar, '.fc-event', 7,
    //     "should display 7 events ('event 5' counts for 2 because it spans two weeks and thus generate two fc-event elements)");
    // await testUtils.dom.click(calendar.$('.o_calendar_filter input[type="checkbox"]').first());
    // assert.containsN(calendar, '.fc-event', 4, "should now only display 4 event");
    // await testUtils.dom.click(calendar.$('.o_calendar_filter input[type="checkbox"]').eq(1));
    // assert.containsNone(calendar, '.fc-event', "should not display any event anymore");

    // // test search bar in filter
    // await testUtils.dom.click($sidebar.find('input[type="text"]'));
    // assert.strictEqual($('ul.ui-autocomplete li:not(.o_m2o_dropdown_option)').length, 2,"should display 2 choices in one2many autocomplete"); // TODO: remove :not(.o_m2o_dropdown_option) because can't have "create & edit" choice
    // await testUtils.dom.click($('ul.ui-autocomplete li:first'));
    // assert.containsN($sidebar, '.o_calendar_filter:has(h5:contains(attendees)) .o_calendar_filter_item', 4, "should display 4 filter items for 'attendees'");
    // await testUtils.dom.click($sidebar.find('input[type="text"]'));
    // assert.strictEqual($('ul.ui-autocomplete li:not(.o_m2o_dropdown_option)').text(), "partner 4", "should display the last choice in one2many autocomplete"); // TODO: remove :not(.o_m2o_dropdown_option) because can't have "create & edit" choice
    // await testUtils.dom.click($sidebar.find('.o_calendar_filter_item .o_remove').first(), {allowInvisible: true});
    // assert.containsN($sidebar, '.o_calendar_filter:has(h5:contains(attendees)) .o_calendar_filter_item', 3, "click on remove then should display 3 filter items for 'attendees'");
    // calendar.destroy();
  });

  QUnit.test("calendar is configured to have no groupBy menu", async function test(assert) {
    assert.expect(2);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `<calendar date_start="start" />`,
      }
    );

    assert.containsOnce(calendar.el, ".o_control_panel", "calendar has a control panel");
    assert.containsNone(
      calendar.el,
      ".o_control_panel .o_search_options .o_group_by_menu",
      "the control panel has no groupBy menu"
    );
  });

  QUnit.test("Week numbering", async function test(assert) {
    // week number depends on the week start, which depends on the locale.
    // The calendar library uses numbers [0 .. 6], while Odoo uses [1 .. 7]
    // so if the modulo is not done, the week number is incorrect.
    assert.expect(1);

    const localizationService = makeFakeLocalizationService({ weekStart: 7 });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `<calendar date_start="start" date_stop="stop" mode="week" />`,
      }
    );

    assert.strictEqual(
      calendar.el.querySelector(".fc-week-number").textContent,
      "Week 51",
      "We should be on the 51st week"
    );
  });

  QUnit.test("Check calendar week column timeformat", async function test(assert) {
    assert.expect(2);

    const localizationService = makeFakeLocalizationService({ timeFormat: "%I:%M:%S" });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `<calendar date_start="start" />`,
      }
    );

    const timeAxis8am = calendar.el.querySelector("[data-time='08:00:00']");
    assert.strictEqual(
      timeAxis8am.textContent,
      "8am",
      "calendar should show according to timeformat"
    );

    const timeAxis11pm = calendar.el.querySelector("[data-time='23:00:00']");
    assert.strictEqual(timeAxis11pm.textContent, "11pm", "event time format should 12 hour");
  });

  QUnit.test("Pick a date", async function test(assert) {
    assert.expect(12);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar all_day="allday" date_start="start" date_stop="stop" mode="week" />
        `,
      }
    );

    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="week"]`, "should be in week mode");
    assert.containsN(
      calendar.el,
      ".o_calendar_event",
      9,
      "should display 9 events on the week (4 event + 5 days event)"
    );

    // Clicking on a day in another week should switch to the other week view
    await click(findDatePickerDayEl(calendar, 19));
    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="week"]`, "should be in week mode");
    assert.containsN(
      calendar.el,
      ".o_calendar_event",
      4,
      "should display 4 events on the week (1 event + 3 days event)"
    );

    // Clicking on a day in the same week should switch to that particular day view
    await click(findDatePickerDayEl(calendar, 18));
    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="day"]`, "should be in day mode");
    assert.containsN(calendar.el, ".o_calendar_event", 2, "should display 2 event on the day");

    // Clicking on the same day should toggle between day, month and week views
    await click(findDatePickerDayEl(calendar, 18));
    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="month"]`, "should be in month mode");
    assert.containsN(
      calendar.el,
      ".o_calendar_event",
      7,
      "should display 7 events on the month (event 5 is on multiple weeks and generates to .o_calendar_event)"
    );

    await click(findDatePickerDayEl(calendar, 18));
    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="week"]`, "should be in week mode");
    assert.containsN(
      calendar.el,
      ".o_calendar_event",
      4,
      "should display 4 events on the week (1 event + 3 days event)"
    );

    await click(findDatePickerDayEl(calendar, 18));
    assert.containsOnce(calendar.el, `.o_calendar_fc[scale="day"]`, "should be in day mode");
    assert.containsN(calendar.el, ".o_calendar_event", 2, "should display 2 event on the day");
  });

  QUnit.skip("Open multiple event form at the same time", async function test(assert) {});

  QUnit.skip("Open form view", async function test(assert) {});

  QUnit.skip("Readonly date_start field", async function test(assert) {});

  QUnit.skip("Give initial date in the context", async function test(assert) {});

  QUnit.skip("Initialize with right locale", async function test(assert) {});

  QUnit.skip("Render year scale", async function test(assert) {});

  QUnit.skip("Event: Create and change", async function test(assert) {});

  QUnit.skip(
    "Event: Create with timezone in week mode European locale",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Create with timezone in week mode European locale with FormViewDialog",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Create with timezone in week mode American locale",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Create with timezone in week mode American locale with FormViewDialog",
    async function test(assert) {}
  );

  QUnit.skip("Event: Create 'all day' event in week mode", async function test(assert) {});

  QUnit.skip(
    "Event: Create 'all day' event in week mode (no QuickCreate)",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Create event with default context (no QuickCreate)",
    async function test(assert) {}
  );

  QUnit.skip("Event: Create event in month mode", async function test(assert) {});

  QUnit.skip(
    "Event: Create and edit event in month mode (allday = false)",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Show start time for single day event in month mode",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Start time should not be shown for date type field",
    async function test(assert) {}
  );

  QUnit.skip(
    "Event: Start time should not be shown if hide_time is true",
    async function test(assert) {}
  );

  QUnit.skip("Event: Start at midnight", async function test(assert) {});

  QUnit.skip("Event: Set event as all day when field is date", async function test(assert) {});

  QUnit.skip(
    "Event: Set event as all day when field is date (no all_day mapping)",
    async function test(assert) {}
  );

  QUnit.skip("Popover: simple rendering", async function test(assert) {
    // assert.expect(14);
    assert.expect(6);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            date_start="start"
            date_stop="stop"
            mode="week"
          >
            <field name="name" string="Custom Name" />
            <field name="partner_id" />
          </calendar>
        `,
      }
    );

    await click(calendar.el, ".o_calendar_event[data-event-id='4']");

    assert.containsOnce(
      popoverManager.el,
      ".o_calendar_popover",
      "should open a popover when clicking on event"
    );
    const popoverHeader = popoverManager.el.querySelector(
      ".o_calendar_popover .o_calendar_popover_header"
    );
    assert.strictEqual(
      popoverHeader.textContent,
      "event 4",
      "popover should have a title 'event 4'"
    );
    assert.containsOnce(
      popoverManager.el,
      ".o_calendar_popover .o_calendar_popover_edit",
      "popover should have an edit button"
    );
    assert.containsOnce(
      popoverManager.el,
      ".o_calendar_popover .o_calendar_popover_delete",
      "popover should have a delete button"
    );
    assert.containsOnce(
      popoverManager.el,
      ".o_calendar_popover .o_calendar_popover_close",
      "popover should have a close button"
    );

    // assert.strictEqual(calendar.$('.o_cw_popover .list-group-item:first b.text-capitalize').text(), 'Wednesday, December 14, 2016', "should display date 'Wednesday, December 14, 2016'");
    // assert.containsN(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item', 2, "popover should have a two fields");

    // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first .o_field_char', "should apply char widget");
    // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first strong').text(), 'Custom Name : ', "label should be a 'Custom Name'");
    // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:first .o_field_char').text(), 'event 4', "value should be a 'event 4'");

    // assert.containsOnce(calendar, '.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_form_uri', "should apply m20 widget");
    // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last strong').text(), 'user : ', "label should be a 'user'");
    // assert.strictEqual(calendar.$('.o_cw_popover .o_cw_popover_fields_secondary .list-group-item:last .o_form_uri').text(), 'partner 1', "value should be a 'partner 1'");

    await click(popoverManager.el, ".o_calendar_popover .o_calendar_popover_close");
    assert.containsNone(popoverManager.el, ".o_calendar_popover", "should close the popover");
  });

  QUnit.test("Popover: delete button depends on delete attribute", async function test(assert) {
    assert.expect(2);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            date_start="start"
            date_stop="stop"
            mode="month"
            delete="0"
          />
        `,
      }
    );

    await click(calendar.el, ".o_calendar_event[data-event-id='4']");

    assert.containsOnce(
      popoverManager.el,
      ".o_calendar_popover",
      "Should open a popover clicking on event"
    );
    assert.containsNone(
      popoverManager.el,
      ".o_calendar_popover .o_calendar_popover_delete",
      "Should not have the 'Delete' button"
    );
  });

  QUnit.test("Popover: attributes hide_date and hide_time", async function test(assert) {
    assert.expect(1);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            hide_date="true"
            hide_time="true"
            mode="month"
          />
        `,
      }
    );

    await click(calendar.el, ".o_calendar_event[data-event-id='4']");
    assert.containsNone(
      popoverManager.el,
      ".o_calendar_popover .list-group-item",
      "popover should not contain date/time"
    );
  });

  QUnit.skip("Popover: render with modifiers", async function test(assert) {
    assert.expect(3);

    const models = testConfig.serverData.models;
    models.event.fields.priority = {
      string: "Priority",
      type: "selection",
      selection: [
        ["0", "Normal"],
        ["1", "Important"],
      ],
    };

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            all_day="allday"
            mode="week"
          >
            <field name="priority" widget="priority" readonly="1" />
          </calendar>`,
      }
    );

    // await testUtils.dom.click($('.fc-event:contains(event 4)'));

    // assert.containsOnce(calendar, '.o_cw_popover', "should open a popover clicking on event");
    // assert.containsOnce(calendar, '.o_cw_popover .o_priority span.o_priority_star', "priority field should not be editable");

    // await testUtils.dom.click($('.o_cw_popover .o_cw_popover_close'));
    // assert.containsNone(calendar, '.o_cw_popover', "should close a popover");
  });

  QUnit.skip("Popover: Render field with specialData", async function test(assert) {
    assert.expect(3);

    // await patchWithCleanup(BasicModel, {
    //     _fetchSpecialDataForMyWidget() {
    //         assert.step("_fetchSpecialDataForMyWidget");
    //         return Promise.resolve();
    //     },
    // });

    // const MyWidget = Widget.extend({
    //     specialData: "_fetchSpecialDataForMyWidget",
    // });

    // fieldRegistry.add('specialWidget', MyWidget);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            all_day="allday"
            mode="week"
          >
            <field name="name" widget="..." />
            <field name="partner_id" />
          </calendar>`,
      }
    );

    // const event4 = document.querySelectorAll(".fc-event")[0];
    // await testUtils.dom.click(event4);
    // assert.containsOnce(calendar, '.o_cw_popover', "should open a popover clicking on event");
    // assert.verifySteps(["_fetchSpecialDataForMyWidget"]);
  });

  QUnit.skip("Popover: render with many2many", async function test(assert) {
    assert.expect(5);

    const models = testConfig.serverData.models;
    models.event.fields.partner_ids.type = "many2many";
    models.event.records[0].partner_ids = [1, 2, 3, 4, 5];
    models.partner.records.push({ id: 5, display_name: "partner 5", image: "EEE" });

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            all_day="allday"
          >
            <field name="partner_ids" widget="many2many_tags_avatar" avatar_field="image" write_model="filter_partner" write_field="partner_id"/>
          </calendar>`,
      }
    );

    // assert.containsN(calendar, ".o_calendar_filter_items .o_cw_filter_avatar", 3,
    //   "should have 3 avatars in the side bar");

    // await testUtils.dom.click(calendar.$(".o_calendar_filter_item[data-value=all] input"));

    // // Event 1
    // await testUtils.dom.click(calendar.$(".fc-event:first"));
    // assert.ok(calendar.$(".o_cw_popover").length, "should open a popover clicking on event");
    // assert.strictEqual(calendar.$(".o_cw_popover").find("img").length, 1, "should have 1 avatar");

    // // Event 2
    // await testUtils.dom.click(calendar.$(".fc-event:eq(1)"));
    // assert.ok(calendar.$(".o_cw_popover").length, "should open a popover clicking on event");
    // assert.strictEqual(calendar.$(".o_cw_popover").find("img").length, 5, "should have 5 avatar");
  });

  QUnit.test("Scale: Breadcrumbs are updated depending on scale", async function test(assert) {
    assert.expect(3);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            date_start="start"
            date_stop="stop"
            mode="day"
          />
        `,
        action: { name: "Meetings" },
      }
    );

    assert.strictEqual(
      findItem(calendar.el, ".breadcrumb-item.active").textContent,
      "Meetings (December 12, 2016)",
      "Should display the current day"
    );

    await calendarUtils.changeScale(calendar, "week");
    assert.strictEqual(
      findItem(calendar.el, ".breadcrumb-item.active").textContent,
      "Meetings (Dec 11 – 17, 2016)",
      "Should display the current week"
    );

    await calendarUtils.changeScale(calendar, "month");
    assert.strictEqual(
      findItem(calendar.el, ".breadcrumb-item.active").textContent,
      "Meetings (December 2016)",
      "Should display the current month"
    );

    // assert.strictEqual(
    //   findItem(calendar.el, ".breadcrumb-item.active").textContent,
    //   "Meetings (2016)",
    //   "Should display the current day"
    // );
  });

  QUnit.test("Scale: Allowed scales", async function test(assert) {
    assert.expect(3);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `<calendar date_start="start" scales="day,week" />`,
      }
    );

    assert.containsN(calendar.el, ".o_calendar_scale_buttons button", 2);
    assert.containsOnce(calendar.el, ".o_calendar_scale_buttons .o_calendar_button_day");
    assert.containsOnce(calendar.el, ".o_calendar_scale_buttons .o_calendar_button_week");
  });

  QUnit.test("Week start: Week: US (default)", async function test(assert) {
    assert.expect(3);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2016-12-17 23:59:59"],
              ["stop", ">=", "2016-12-11 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="week" />
        `,
      }
    );

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

  QUnit.test("Week start: Week: EU", async function test(assert) {
    assert.expect(3);

    const localizationService = makeFakeLocalizationService({ weekStart: 1 });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2016-12-18 23:59:59"],
              ["stop", ">=", "2016-12-12 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="week" />
        `,
      }
    );

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

  QUnit.test("Week start: Week: Saturday", async function test(assert) {
    assert.expect(3);

    const localizationService = makeFakeLocalizationService({ weekStart: 6 });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2016-12-16 23:59:59"],
              ["stop", ">=", "2016-12-10 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="week" />
        `,
      }
    );

    const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
    assert.strictEqual(
      dayHeaders[0].textContent,
      "Sat 10",
      "The first day of the week should be Monday"
    );
    assert.strictEqual(
      dayHeaders[dayHeaders.length - 1].textContent,
      "Fri 16",
      "The last day of the week should be Sunday"
    );
  });

  QUnit.test("Week start: Month: US (default)", async function test(assert) {
    assert.expect(3);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2016-12-31 23:59:59"],
              ["stop", ">=", "2016-11-27 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="month" />
        `,
      }
    );

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
  });

  QUnit.test("Week start: Month: EU", async function test(assert) {
    assert.expect(3);

    const localizationService = makeFakeLocalizationService({ weekStart: 1 });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2017-01-01 23:59:59"],
              ["stop", ">=", "2016-11-28 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="month" />
        `,
      }
    );

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
  });

  QUnit.test("Week start: Month: Saturday", async function test(assert) {
    assert.expect(3);

    const localizationService = makeFakeLocalizationService({ weekStart: 6 });
    testConfig.serviceRegistry.add("localization", localizationService);

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { kwargs, method, model }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, [
              ["start", "<=", "2017-01-06 23:59:59"],
              ["stop", ">=", "2016-11-26 00:00:00"],
            ]);
          }
          // return this._super(...arguments);
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar date_start="start" date_stop="stop" mode="month" />
        `,
      }
    );

    const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
    assert.strictEqual(
      dayHeaders[0].textContent,
      "Saturday",
      "The first day of the week should be Saturday"
    );
    assert.strictEqual(
      dayHeaders[dayHeaders.length - 1].textContent,
      "Friday",
      "The last day of the week should be Friday"
    );
  });

  QUnit.test("Filters: 'all' filter", async function test(assert) {
    assert.expect(8);

    const dateRangeDomain = [
      ["start", "<=", "2016-12-17 23:59:59"],
      ["stop", ">=", "2016-12-11 00:00:00"],
    ];

    const domainsToTest = [
      dateRangeDomain.concat([["partner_ids", "in", []]]),
      dateRangeDomain.concat([["partner_ids", "in", [1]]]),
      dateRangeDomain.concat([["partner_ids", "in", [2, 1]]]),
      dateRangeDomain,
    ];

    let i = 0;
    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { method, model, kwargs }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(kwargs.domain, domainsToTest[i]);
            i += 1;
          }
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            date_start="start"
            date_stop="stop"
            mode="week"
            attendee="partner_ids"
            color="partner_id"
          >
            <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
          </calendar>
        `,
      }
    );

    assert.containsNone(calendar.el, ".o_calendar_event", "Should display 0 events on the week");

    await click(calendar.el, ".o_calendar_filter_item #partner_ids_1");
    assert.containsN(calendar.el, ".o_calendar_event", 4, "Should display 4 events on the week");

    await click(calendar.el, ".o_calendar_filter_item #partner_ids_2");
    assert.containsN(calendar.el, ".o_calendar_event", 9, "Should display 9 events on the week");

    await click(calendar.el, ".o_calendar_filter_item #partner_ids_all");
    assert.containsN(calendar.el, ".o_calendar_event", 9, "Should display 9 events on the week");
  });

  QUnit.test("Filters: Add filters and specific color", async function test(assert) {
    assert.expect(7);

    testConfig.serverData.models.event.records.push(
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

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            all_day="allday"
            date_start="start"
            date_stop="stop"
            mode="week"
            color="color"
          >
            <field name="partner_ids" write_model="filter_partner" write_field="partner_id" />
            <field name="event_type_id" filters="1" color="color" />
          </calendar>
        `,
      }
    );

    assert.containsOnce(calendar.el, ".o_calendar_filter_section", "should display 1 section");

    // By default no filter is selected. We check before continuing.
    await click(calendar.el, ".o_calendar_filter_item #partner_ids_1");
    await click(calendar.el, ".o_calendar_filter_item #partner_ids_2");

    assert.containsN(calendar.el, ".o_calendar_filter_section", 2, "should display 2 sections");

    const eventTypeSection = calendar.el.querySelectorAll(".o_calendar_filter_section")[1];
    assert.strictEqual(
      eventTypeSection.querySelector(".o_calendar_filter_section_title").textContent,
      "Event Type"
    );

    assert.containsOnce(eventTypeSection, "#o_calendar_filter_section_folded_event_type_id");
    assert.containsN(eventTypeSection, ".o_calendar_filter_item", 3);
    assert.containsOnce(
      eventTypeSection,
      ".o_calendar_filter_item label[for='event_type_id_1'] .o_calendar_filter_item_input_color_1"
    );
    assert.containsOnce(
      calendar.el,
      ".o_calendar_event[data-event-id='8'].o_calendar_event_color_4"
    );
  });

  QUnit.skip("Filters: Create event", async function test(assert) {});

  QUnit.skip("Filters: Create event (no QuickCreate)", async function test(assert) {});

  QUnit.skip("Filters: Update event", async function test(assert) {});

  QUnit.skip("Filters: Change pager", async function test(assert) {});

  QUnit.skip("Filters: Filter year scale", async function test(assert) {});

  QUnit.test("Timezone: Timezone does not affect current day", async function test(assert) {
    assert.expect(2);

    const userService = makeFakeUserService({ userId: uid, tz: "UTC-40" });
    testConfig.serviceRegistry.add("user", userService, { force: true });

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `<calendar date_start="start" />`,
      }
    );

    assert.strictEqual(
      calendarUtils.findDatePickerCurrentDayEl(calendar).textContent,
      "12",
      "should highlight the target day"
    );

    // Go to previous day
    await click(calendarUtils.findDatePickerDayEl(calendar, 11));
    assert.strictEqual(
      calendarUtils.findDatePickerCurrentDayEl(calendar).textContent,
      "11",
      "should highlight the selected day"
    );
  });

  QUnit.test("Timezone: Fetch event when being in timezone", async function test(assert) {
    assert.expect(3);

    const userService = makeFakeUserService({ userId: uid, tz: "UTC-11" });
    testConfig.serviceRegistry.add("user", userService, { force: true });

    const calendar = await calendarUtils.makeView(
      {
        testConfig,
        mockRPC(_, { method, model, kwargs }) {
          if (method === "search_read" && model === "event") {
            assert.deepEqual(
              kwargs.domain,
              [
                ["start", "<=", "2016-12-17 12:59:59"],
                ["stop", ">=", "2016-12-10 13:00:00"],
              ],
              "The domain should contain the right range"
            );
          }
        },
      },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            mode="week"
          />
        `,
      }
    );

    const dayHeaders = calendar.el.querySelectorAll(".fc-day-header");
    assert.strictEqual(
      dayHeaders[0].textContent,
      "Sun 11",
      "The calendar start date should be 2016-12-11"
    );
    assert.strictEqual(
      dayHeaders[6].textContent,
      "Sat 17",
      "The calendar stop date should be 2016-12-17"
    );

    calendar.destroy();
  });

  QUnit.skip("Timezone: Timezone does not affect drag and drop", async function test(assert) {});

  QUnit.skip(
    "Timezone: Timezone does not affect calendar with date type field",
    async function test(assert) {}
  );

  QUnit.skip("QuickCreate: Custom create_name_field", async function test(assert) {});

  QUnit.skip(
    "QuickCreate: Switching to actual create for required fields",
    async function test(assert) {}
  );

  QUnit.skip("QuickCreate: Avoid double event creation", async function test(assert) {});

  QUnit.skip("Drag and Drop: month", async function test(assert) {
    assert.expect(2);

    const calendar = await calendarUtils.makeView(
      { testConfig },
      {
        type: "calendar",
        model: "event",
        arch: `
          <calendar
            date_start="start"
            date_stop="stop"
            mode="month"
            event_open_popup="true"
            quick_add="false"
          >
            <field name="name" />
            <field name="parnter_id" />
          </calendar>`,
      }
    );

    // // Create event (on 20 december)
    // var $cell = calendar.$('.fc-day-grid .fc-row:eq(3) .fc-day:eq(2)');
    // testUtils.triggerMouseEvent($cell, "mousedown");
    // testUtils.triggerMouseEvent($cell, "mouseup");
    // await testUtils.nextTick();
    // var $input = $('.modal-body input:first');
    // await testUtils.fields.editInput($input, "An event");
    // await testUtils.dom.click($('.modal button.btn-primary'));
    // await testUtils.nextTick();

    // // Move event to another day (on 19 december)
    // await testUtils.dragAndDrop(
    //     calendar.$('.fc-event:contains("An event")'),
    //     calendar.$('.fc-day-grid .fc-row:eq(3) .fc-day-top:eq(1)')
    // );
    // await testUtils.nextTick();
    // await testUtils.dom.click(calendar.$('.fc-event:contains("An event")'));

    // assert.containsOnce(calendar, '.popover:contains("07:00")',
    //     "start hour shouldn't have been changed");
    // assert.containsOnce(calendar, '.popover:contains("19:00")',
    //     "end hour shouldn't have been changed");
  });

  QUnit.skip("Drag and Drop: month with all_day mapping", async function test(assert) {});

  QUnit.skip("Drag and Drop: month with date_start and date_delay", async function test(assert) {});

  QUnit.skip("Drag and Drop: week with 24h event", async function test(assert) {});
});
