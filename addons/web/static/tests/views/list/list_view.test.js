import { Component, onRendered, onWillRender, xml } from "@odoo/owl";
import { after, beforeEach, expect, test } from "@odoo/hoot";
import { keyDown } from "@odoo/hoot-dom";
import { click, dblclick, drag, edit, hover, leave, pointerDown, press, queryAll, queryAllTexts, queryFirst, queryOne, queryText, resize } from "@odoo/hoot-dom";
import { animationFrame, Deferred, runAllTimers } from "@odoo/hoot-mock";
import { clickKanbanLoadMore, clickSave, contains, createKanbanRecord, defineModels, defineParams, discardKanbanRecord, editKanbanColumnName, editKanbanRecord, editKanbanRecordQuickCreateInput, fields, getDropdownMenu, getFacetTexts, getKanbanColumn, getKanbanColumnDropdownMenu, getKanbanColumnTooltips, getKanbanCounters, getKanbanProgressBars, getKanbanRecord, getKanbanRecordTexts, getPagerLimit, getPagerValue, getService, makeServerError, MockServer, mockService, models, mountView, mountWithCleanup, onRpc, pagerNext, patchWithCleanup, quickCreateKanbanColumn, quickCreateKanbanRecord, serverState, stepAllNetworkCalls, toggleKanbanColumnActions, toggleKanbanRecordDropdown, toggleMenuItem, toggleMenuItemOption, toggleSearchBarMenu, validateKanbanColumn, validateKanbanRecord, validateSearch, webModels } from "@web/../tests/web_test_helpers";

import { currencies } from "@web/core/currency";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { getOrigin } from "@web/core/utils/urls";
import { RelationalModel } from "@web/model/relational_model/relational_model";
import { SampleServer } from "@web/model/sample_server";
import { KanbanCompiler } from "@web/views/kanban/kanban_compiler";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { KanbanRecord } from "@web/views/kanban/kanban_record";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { ViewButton } from "@web/views/view_button/view_button";
import { AnimatedNumber } from "@web/views/view_components/animated_number";
import { WebClient } from "@web/webclient/webclient";
import { keyUp } from "../../../lib/hoot-dom/helpers/events";

const { ResCompany, ResPartner, ResUsers } = webModels;

const fieldRegistry = registry.category("fields");
const viewRegistry = registry.category("views");
const viewWidgetRegistry = registry.category("view_widgets");

// import { Component, markup, onRendered, onWillStart, xml } from "@odoo/owl";
// import { browser } from "@web/core/browser/browser";
// import { Domain } from "@web/core/domain";
// import { currencies } from "@web/core/currency";
// import { errorService } from "@web/core/errors/error_service";
// import { localization } from "@web/core/l10n/localization";
// import { registry } from "@web/core/registry";
// import { tooltipService } from "@web/core/tooltip/tooltip_service";
// import { uiService } from "@web/core/ui/ui_service";
// import { getNextTabableElement } from "@web/core/utils/ui";
// import { session } from "@web/session";
// import { FloatField } from "@web/views/fields/float/float_field";
// import { AutoComplete } from "@web/core/autocomplete/autocomplete";
// import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
// import { textField } from "@web/views/fields/text/text_field";
// import { ListController } from "@web/views/list/list_controller";
// import { RelationalModel } from "@web/model/relational_model/relational_model";
// import { actionService } from "@web/webclient/actions/action_service";
// import { getPickerApplyButton, getPickerCell } from "../core/datetime/datetime_test_helpers";
// import {
//     makeFakeLocalizationService,
//     patchUserWithCleanup,
//     patchUserContextWithCleanup,
// } from "../helpers/mock_services";
// import {
//     addRow,
//     click,
//     clickDiscard,
//     clickOpenM2ODropdown,
//     clickOpenedDropdownItem,
//     clickSave,
//     drag,
//     dragAndDrop,
//     editInput,
//     editSelect,
//     getFixture,
//     getNodesTextContent,
//     makeDeferred,
//     mouseEnter,
//     nextTick,
//     patchDate,
//     patchTimeZone,
//     patchWithCleanup,
//     selectDropdownItem,
//     triggerEvent,
//     triggerEvents,
//     triggerHotkey,
// } from "../helpers/utils";
// import {
//     editFavoriteName,
//     editPager,
//     getVisibleButtons,
//     getFacetTexts,
//     getPagerLimit,
//     getPagerValue,
//     groupByMenu,
//     pagerNext,
//     pagerPrevious,
//     removeFacet,
//     saveFavorite,
//     toggleActionMenu,
//     toggleSearchBarMenu,
//     toggleMenuItem,
//     toggleSaveFavorite,
//     validateSearch,
// } from "../search/helpers";
// import { createWebClient, doAction } from "../webclient/helpers";
// import { makeView, makeViewInDialog, setupViewRegistries } from "./helpers";
// import { makeServerError } from "../helpers/mock_server";

// const serviceRegistry = registry.category("services");

async function reloadListView(target) {
    if (target.querySelector(".o_searchview_input")) {
        await validateSearch(target);
    } else {
        await editPager(target, getPagerValue(target));
    }
}

function getDataRow(position) {
    return target.querySelectorAll(".o_data_row")[position - 1];
}

function getGroup(position) {
    return target.querySelectorAll(".o_group_header")[position - 1];
}

function clickAdd() {
    const listAddButtons = target.querySelectorAll(".o_list_button_add");
    if (listAddButtons.length) {
        return listAddButtons.length >= 2 ? click(listAddButtons[1]) : click(listAddButtons[0]);
    } else {
        throw new Error("No add button found to be clicked.");
    }
}

/**
 * @param {Element} el
 * @param {string} varName
 * @returns {string}
 */
function getCssVar(el, varName) {
    return getComputedStyle(el).getPropertyValue(varName);
}

class Foo extends models.Model {
    foo = fields.Char();
    bar = fields.Boolean();
    date = fields.Date();
    datetime = fields.Datetime();
    int_field = fields.Integer({ aggregator: "sum", sortable: true });
    qux = fields.Float({ aggregator: "sum" });
    m2o = fields.Many2one({ relation: "bar" });
    o2m = fields.One2many({ relation: "bar" });
    m2m = fields.Many2many({ relation: "bar" });
    text = fields.Text();
    amount = fields.Monetary({ aggregator: "sum", currency_field: "currency_id" });
    currency_id = fields.Many2one({ relation: "res.currency", default: 1 });
    reference = fields.Reference({
        selection: [
            ["bar", "Bar"],
            ["res.currency", "Currency"],
            // ["event", "Event"],
        ],
    });
    // properties = fields.Properties({ TODO })

    _records = [
        {
            id: 1,
            foo: "yop",
            bar: true,
            date: "2017-01-25",
            datetime: "2016-12-12 10:55:05",
            int_field: 10,
            qux: 0.4,
            m2o: 1,
            m2m: [1, 2],
            amount: 1200,
            currency_id: 2,
            reference: "bar,1",
            // properties: [],
        },
        {
            id: 2,
            foo: "blip",
            bar: true,
            int_field: 9,
            qux: 13,
            m2o: 2,
            m2m: [1, 2, 3],
            amount: 500,
            reference: "res.currency,1",
            // properties: [],
        },
        {
            id: 3,
            foo: "gnap",
            bar: true,
            int_field: 17,
            qux: -3,
            m2o: 1,
            m2m: [],
            amount: 300,
            reference: "res.currency,2",
            // properties: [],
        },
        {
            id: 4,
            foo: "blip",
            bar: false,
            int_field: -4,
            qux: 9,
            m2o: 1,
            m2m: [1],
            amount: 0,
            // properties: [],
        },
    ];
}

class Bar extends models.Model {
    //                 fields: {
    //                     definitions: { type: "properties_definitions" },
    //                 },
    _records = [
        { id: 1, display_name: "Value 1", /* definitions: [] */ },
        { id: 2, display_name: "Value 2", /* definitions: [] */ },
        { id: 3, display_name: "Value 3", /* definitions: [] */ },
    ];
}

class Currency extends models.Model {
    _name = "res.currency";

    name = fields.Char();
    symbol = fields.Char();
    position = fields.Selection({
        selection: [
            ["after", "A"],
            ["before", "B"],
        ],
    });

    _records = [
        { id: 1, name: "USD", symbol: "$", position: "before" },
        { id: 2, name: "EUR", symbol: "€", position: "after" },
    ];
}

//             event: {
//                 fields: {
//                     id: { string: "ID", type: "integer" },
//                     name: { string: "name", type: "char" },
//                 },
//                 records: [{ id: "2-20170808020000", name: "virtual" }],
//             },
//         },
//     };
// });

defineModels([Foo, Bar, Currency, ResCompany, ResPartner, ResUsers]);

test("simple readonly list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
    });

    // 3 th (1 for checkbox, 2 for columns)
    expect("th").toHaveCount(3, { message: "should have 3 columns" });

    expect("td:contains(gnap)").toHaveCount(1, { message: "should contain gnap" });
    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
    expect("th.o_column_sortable").toHaveCount(2, { message: "should have 2 sortable column" });

    expect("thead th:eq(2) .o_list_number_th").toHaveCount(1, { message: "header cells of integer fields should have o_list_number_th class" });
    expect("tbody tr:first td:eq(2)").toHaveStyle({ "text-align": "right" }, { message: "integer cells should be right aligned" });
    expect(".d-xl-none .o_list_button_add").not.toBeVisible();
    expect(".d-xl-inline-flex .o_list_button_add").toBeVisible();
    expect(".o_list_button_save").not.toBeVisible();
    expect(".o_list_button_discard").not.toBeVisible();
});

test.todo("select record range with shift click", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
    });
    await click(queryFirst(".o_data_row .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("1 selected");
    expect(".o_data_row .o_list_record_selector input:checked").toHaveCount(1);

    // shift click the 4th record to have 0-1-2-3 toggled
    await triggerEvents(target.querySelectorAll()[3], null, [["keydown", { key: "Shift", shiftKey: true }], "click"]);

    expect(queryText(".o_list_selection_box")).toBe("4 selected");
    expect(document.querySelectorAll(".o_data_row .o_list_record_selector input:checked").length).toBe(4);

    // shift click the 3rd record to untoggle 2-3
    await triggerEvents(target.querySelectorAll(".o_data_row .o_list_record_selector input")[2], null, [["keydown", { key: "Shift", shiftKey: true }], "click"]);
    expect(queryText(".o_list_selection_box")).toBe("2 selected");
    expect(document.querySelectorAll(".o_data_row .o_list_record_selector input:checked").length).toBe(2);

    // shift click the 1st record to untoggle 0-1
    await triggerEvents(queryFirst(".o_data_row .o_list_record_selector input"), null, [["keydown", { key: "Shift", shiftKey: true }], "click"]);
    expect(document.querySelectorAll(".o_data_row .o_list_record_selector input:checked").length).toBe(0);
});

test("select record range with shift+space", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
    });

    // Go to the first checkbox and check it
    press("ArrowDown");
    press("ArrowDown");
    await animationFrame();
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeFocused();
    await contains(".o_data_row:nth-child(1) .o_list_record_selector input").click();
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeChecked();

    // Go to the fourth checkbox and shift+space
    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    await animationFrame();
    expect(".o_data_row:nth-child(4) .o_list_record_selector input").toBeFocused();
    expect(".o_data_row:nth-child(4) .o_list_record_selector input").not.toBeChecked();
    press("shift+space");
    await animationFrame();
    // focus is on the input and not in the td cell
    expect(document.activeElement.tagName).toBe("INPUT");

    // Check that all checkbox is checked
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(2) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(3) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(4) .o_list_record_selector input").toBeChecked();
});

test("expand range of checkbox with shift+arrow", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
    });

    // Go to the first checkbox and check it
    press("ArrowDown");
    press("ArrowDown");
    await animationFrame();
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeFocused();
    await contains(".o_data_row:nth-child(1) .o_list_record_selector input").click();
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeChecked();

    // expand the checkbox with arrowdown
    press("shift+ArrowDown");
    press("shift+ArrowDown");
    press("shift+ArrowDown");
    press("shift+ArrowUp");
    await animationFrame();
    expect(".o_data_row:nth-child(3) .o_list_record_selector input").toBeFocused();
    expect(".o_data_row:nth-child(3) .o_list_record_selector input").toBeChecked();

    // Check that the three checkbox are checked
    expect(".o_data_row:nth-child(2) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(3) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(4) .o_list_record_selector input").toBeChecked();
});

test.todo("multiple interactions to change the range of checked boxes", async () => {
    for (let i = 0; i < 5; i++) {
        Foo._records.push({ id: 5 + i, bar: true, foo: "foo" + i });
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
    });

    press("ArrowDown");
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").not.toBeFocused();
    
    keyDown("shift");
    press("shift+ArrowDown");
    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeFocused();
    await animationFrame();
    press("shift+ArrowDown");
    await animationFrame();
    press("shift+ArrowDown");
    await animationFrame();
    press("shift+ArrowDown");
    await animationFrame();
    press("shift+ArrowUp");
    await animationFrame();
    keyUp("shift");
    press("ArrowDown");
    await animationFrame();
    press("ArrowDown");
    await animationFrame();
    press("shift+ArrowDown");
    await animationFrame();

    await contains(".o_data_row:nth-child(8) .o_list_record_selector .o-checkbox").click();
    press("shift+ArrowDown");

    expect(".o_data_row:nth-child(1) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(2) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(3) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(4) .o_list_record_selector input").not.toBeChecked();
    expect(".o_data_row:nth-child(5) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(6) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(7) .o_list_record_selector input").not.toBeChecked();
    expect(".o_data_row:nth-child(8) .o_list_record_selector input").toBeChecked();
    expect(".o_data_row:nth-child(9) .o_list_record_selector input").toBeChecked();
});

test("list with class and style attributes", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: /* xml */ `
            <tree class="myClass" style="border: 1px solid red;">
                <field name="foo"/>
            </tree>
        `,
    });
    expect(".o_view_controller[style*='border: 1px solid red;'], .o_view_controller [style*='border: 1px solid red;']").toHaveCount(0, { message: "style attribute should not be copied" });
    expect(".o_view_controller.o_list_view.myClass").toHaveCount(1, { message: "class attribute should be passed to the view controller" });
    expect(".myClass").toHaveCount(1, { message: "class attribute should ONLY be passed to the view controller" });
});

test('list with create="0"', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree create="0"><field name="foo"/></tree>',
    });

    expect(".o_list_button_add").toHaveCount(0, { message: "should not have the 'Create' button" });
});

test("searchbar in listview doesn't take focus after unselected all items", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree><field name="foo"/></tree>`,
    });

    assert.equal(document.activeElement, target.querySelector(".o_searchview_input"), "The search input should be have the focus");
    await click(target, `tbody .o_data_row:first-child input[type="checkbox"]`);
    await click(target, `tbody input[type="checkbox"]:checked`);
    assert.notEqual(document.activeElement, target.querySelector(".o_searchview_input"), "The search input shouldn't have the focus");
});

test("basic list view and command palette", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
    });

    triggerHotkey("control+k");
    await nextTick();

    expect(getNodesTextContent(target.querySelectorAll(".o_command_hotkey"))).toEqual(["NewALT + C", "ActionsALT + U", "Search...ALT + Q", "Toggle search panelALT + SHIFT + Q"]);
});

test('list with delete="0"', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree delete="0"><field name="foo"/></tree>',
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "should have 4 records" });

    await click(target.querySelector("tbody td.o_list_record_selector input"));
    expect(".o-dropdown--menu").toHaveCount(0);
});

test('editable list with edit="0"', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top" edit="0"><field name="foo"/></tree>',
        selectRecord: (resId, options) => {
            assert.step(`switch to form - resId: ${resId} activeIds: ${options.activeIds}`);
        },
    });

    assert.ok(target.querySelectorAll("tbody td.o_list_record_selector").length, "should have at least one record");

    await click(target.querySelector(".o_data_cell"));
    expect("tbody tr.o_selected_row").toHaveCount(0, { message: "should not have editable row" });

    expect(["switch to form - resId: 1 activeIds: 1,2,3,4"]).toVerifySteps();
});

test("non-editable list with open_form_view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree open_form_view="1"><field name="foo"/></tree>',
    });
    expect("td.o_list_record_open_form_view").toHaveCount(0, { message: "button to open form view should not be present on non-editable list" });
});

test("editable list with open_form_view not set", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
    });
    expect("td.o_list_record_open_form_view").toHaveCount(0, { message: "button to open form view should not be present" });
});

test("editable list with open_form_view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top" open_form_view="1"><field name="foo"/></tree>',
        selectRecord: (resId, options) => {
            assert.step(`switch to form - resId: ${resId} activeIds: ${options.activeIds}`);
        },
    });
    expect("td.o_list_record_open_form_view").toHaveCount(4, { message: "button to open form view should be present on each rows" });
    await click(target.querySelector("td.o_list_record_open_form_view"));
    expect(["switch to form - resId: 1 activeIds: 1,2,3,4"]).toVerifySteps();
});

test("export feature in list for users not in base.group_allow_export", async () => {
    function hasGroup(group) {
        return Promise.resolve(group !== "base.group_allow_export");
    }
    patchUserWithCleanup({ hasGroup });

    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree><field name="foo"/></tree>',
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(0);
    assert.ok($(target).find("tbody td.o_list_record_selector").length, "should have at least one record");
    expect("div.o_control_panel .o_cp_buttons .o_list_export_xlsx").toHaveCount(0);
    await click(target.querySelector("tbody td.o_list_record_selector input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    await toggleActionMenu(target);
    expect(getNodesTextContent(target.querySelectorAll(".o-dropdown--menu .o_menu_item"))).toEqual(["Duplicate", "Delete"], { message: "action menu should not contain the Export button" });
});

test("list with export button", async () => {
    function hasGroup(group) {
        return Promise.resolve(group === "base.group_allow_export");
    }
    patchUserWithCleanup({ hasGroup });

    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree><field name="foo"/></tree>',
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    assert.ok(target.querySelectorAll("tbody td.o_list_record_selector").length, "should have at least one record");

    await click(target.querySelector("tbody td.o_list_record_selector input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    await toggleActionMenu(target);
    expect(getNodesTextContent(target.querySelectorAll(".o-dropdown--menu .o_menu_item"))).toEqual(["Export", "Duplicate", "Delete"], { message: "action menu should have Export button" });
});

test("Direct export button invisible", async () => {
    function hasGroup(group) {
        return Promise.resolve(group === "base.group_allow_export");
    }
    patchUserWithCleanup({ hasGroup });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree export_xlsx="0"><field name="foo"/></tree>`,
    });
    expect(".o_list_export_xlsx").toHaveCount(0);
});

test("list view with adjacent buttons", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" type="object" icon="fa-car"/>
                <field name="foo"/>
                <button name="x" type="object" icon="fa-star"/>
                <button name="y" type="object" icon="fa-refresh"/>
                <button name="z" type="object" icon="fa-exclamation"/>
            </tree>`,
    });

    expect("th").toHaveCount(4, { message: "adjacent buttons in the arch must be grouped in a single column" });
    expect(".o_data_row:first-child td.o_list_button").toHaveCount(2)
});

test("list view with adjacent buttons and invisible field and button", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" type="object" icon="fa-car"/>
                <field name="foo" column_invisible="1"/>
                <!--Here the column_invisible=1 is used to simulate a group on the case that the user
                    don't have the rights to see the button.-->
                <button name="b" type="object" icon="fa-car" column_invisible="1"/>
                <button name="x" type="object" icon="fa-star"/>
                <button name="y" type="object" icon="fa-refresh"/>
                <button name="z" type="object" icon="fa-exclamation"/>
            </tree>`,
    });

    expect("th").toHaveCount(3, { message: "adjacent buttons in the arch must be grouped in a single column" });
    expect("tr:first-child button").toHaveCount(4, { message: "Only 4 buttons should be visible" });
    expect(".o_data_row:first-child td.o_list_button").toHaveCount(2)
});

test("list view with adjacent buttons and invisible field (modifier)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" type="object" icon="fa-car"/>
                <field name="foo" invisible="foo == 'blip'"/>
                <button name="x" type="object" icon="fa-star"/>
                <button name="y" type="object" icon="fa-refresh"/>
                <button name="z" type="object" icon="fa-exclamation"/>
            </tree>`,
    });

    expect("th").toHaveCount(4, { message: "adjacent buttons in the arch must be grouped in a single column" });
    expect(".o_data_row:first-child td.o_list_button").toHaveCount(2)
});

test("list view with adjacent buttons and optional field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" type="object" icon="fa-car"/>
                <field name="foo" optional="hide"/>
                <button name="x" type="object" icon="fa-star"/>
                <button name="y" type="object" icon="fa-refresh"/>
                <button name="z" type="object" icon="fa-exclamation"/>
            </tree>`,
    });

    expect("th").toHaveCount(4, { message: "adjacent buttons in the arch must be grouped in a single column" });
    expect(".o_data_row:first-child td.o_list_button").toHaveCount(2)
});

test("list view with adjacent buttons with invisible modifier", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <button name="x" type="object" icon="fa-star" invisible="foo == 'blip'"/>
                <button name="y" type="object" icon="fa-refresh" invisible="foo == 'yop'"/>
                <button name="z" type="object" icon="fa-exclamation" invisible="foo == 'gnap'"/>
            </tree>`,
    });

    expect("th").toHaveCount(3, { message: "adjacent buttons in the arch must be grouped in a single column" });
    expect(".o_data_row td.o_list_button").toHaveCount(1);
    expect($(target).find(".o_field_cell").text()).toBe("yopblipgnapblip");
    expect("td button i.fa-star").toHaveCount(2);
    expect("td button i.fa-refresh").toHaveCount(3);
    expect("td button i.fa-exclamation").toHaveCount(3);
});

test("list view with icon buttons", async () => {
    serverData.models.foo.records.splice(1);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="x" type="object" icon="fa-asterisk"/>
                <button name="x" type="object" icon="fa-star" class="o_yeah"/>
                <button name="x" type="object" icon="fa-refresh" string="Refresh" class="o_yeah"/>
                <button name="x" type="object" icon="fa-exclamation" string="Danger" class="o_yeah btn-danger"/>
            </tree>`,
    });

    expect("button.btn.btn-link i.fa.fa-asterisk").toHaveCount(1);
    expect("button.btn.btn-link.o_yeah i.fa.fa-star").toHaveCount(1);
    assert.containsOnce(target, 'button.btn.btn-link.o_yeah:contains("Refresh") i.fa.fa-refresh');
    assert.containsOnce(target, 'button.btn.btn-danger.o_yeah:contains("Danger") i.fa.fa-exclamation');
    expect("button.btn.btn-link.btn-danger").toHaveCount(0);
});

test("list view with disabled button", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" icon="fa-coffee"/>
                <button name="b" icon="fa-car" disabled="disabled"/>
            </tree>`,
    });

    assert.ok(Array.from(target.querySelectorAll("button[name='a']")).every((btn) => !btn.disabled));
    assert.ok(Array.from(target.querySelectorAll("button[name='b']")).every((btn) => btn.disabled));
});

test("list view: action button in controlPanel basic rendering", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <header>
                        <button name="x" type="object" class="plaf" string="plaf"/>
                        <button name="y" type="object" class="plouf" string="plouf" invisible="not context.get('bim')"/>
                </header>
                <field name="foo" />
            </tree>`,
    });
    let cpBreadcrumb = target.querySelector("div.o_control_panel_actions");
    assert.containsNone(cpBreadcrumb, 'button[name="x"]');
    assert.containsNone(cpBreadcrumb, ".o_list_selection_box");
    assert.containsNone(cpBreadcrumb, 'button[name="y"]');

    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    cpBreadcrumb = target.querySelector("div.o_control_panel_actions");
    assert.containsOnce(cpBreadcrumb, 'button[name="x"]');
    expect("x").toHaveClass("btn btn-secondary plaf");
    assert.containsOnce(cpBreadcrumb, ".o_list_selection_box");
    expect(cpBreadcrumb.querySelector('button[name="x"]').previousElementSibling).toBe(cpBreadcrumb.querySelector(".o_list_selection_box"));
    assert.containsNone(cpBreadcrumb, 'button[name="y"]');

    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    cpBreadcrumb = target.querySelector("div.o_control_panel_actions");
    assert.containsNone(cpBreadcrumb, 'button[name="x"]');
    assert.containsNone(cpBreadcrumb, ".o_list_selection_box");
    assert.containsNone(cpBreadcrumb, 'button[name="y"]');
});

test("list view: action button in controlPanel with display='always'", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <header>
                    <button name="display" type="object" class="display" string="display" display="always"/>
                    <button name="display" type="object" class="display_invisible" string="invisible 1" display="always" invisible="1"/>
                    <button name="display" type="object" class="display_invisible" string="invisible context" display="always" invisible="context.get('a')"/>
                    <button name="default-selection" type="object" class="default-selection" string="default-selection"/>
                </header>
                <field name="foo" />
            </tree>`,
        context: {
            a: true,
        },
    });
    let cpButtons = getVisibleButtons(target);
    assert.deepEqual(
        [...cpButtons].map((button) => button.textContent.trim()),
        [
            "New",
            "display",
            "", // magnifying glass btn
            "", // cog dropdown
            "", // search btn
        ]
    );

    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    cpButtons = getVisibleButtons(target);
    assert.deepEqual(
        [...cpButtons].map((button) => button.textContent.trim()),
        ["New", "display", "default-selection"]
    );

    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    cpButtons = getVisibleButtons(target);
    assert.deepEqual(
        [...cpButtons].map((button) => button.textContent.trim()),
        [
            "New",
            "display",
            "", // magnifying glass btn
            "", // cog dropdown
            "", // search btn
        ]
    );
});

test("list view: give a context dependent on the current context to a header button", async () => {
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <header>
                    <button name="toDo" type="object" string="toDo" display="always" context="{'b': context.get('a')}"/>
                </header>
                <field name="foo" />
            </tree>`,
        context: {
            a: "yop",
        },
    });

    patchWithCleanup(list.env.services.action, {
        doActionButton: (action) => {
            assert.step("doActionButton");
            assert.deepEqual(action.buttonContext, {
                active_domain: [],
                active_ids: [],
                active_model: "foo",
                b: "yop",
            });
        },
    });

    const cpButtons = getVisibleButtons(target);
    await click(cpButtons[1]);
    expect(["doActionButton"]).toVerifySteps();
});

test("list view: action button executes action on click: buttons are disabled and re-enabled", async () => {
    const executeActionDef = makeDeferred();
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <header>
                            <button name="x" type="object" class="plaf" string="plaf"/>
                    </header>
                    <field name="foo" />
                </tree>`,
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: async () => {
            await executeActionDef;
        },
    });
    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    const cpButtons = getVisibleButtons(target);
    assert.ok([...cpButtons].every((btn) => !btn.disabled));
    await click(cpButtons[1]);
    assert.ok([...cpButtons].every((btn) => btn.disabled));

    executeActionDef.resolve();
    await nextTick();
    assert.ok([...cpButtons].every((btn) => !btn.disabled));
});

test("list view: buttons handler is called once on double click", async () => {
    const executeActionDef = makeDeferred();
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="foo" />
                    <button name="x" type="object" class="do_something" string="Do Something"/>
                </tree>`,
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: async () => {
            assert.step("execute_action");
            await executeActionDef;
        },
    });
    const button = target.querySelector("tbody .o_list_button > button");
    await click(button);
    assert.ok(button.matches("[disabled]"));

    executeActionDef.resolve();
    await nextTick();
    expect(["execute_action"]).toVerifySteps();
});

test("list view: click on an action button saves the record before executing the action", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo" />
                    <button name="toDo" type="object" class="do_something" string="Do Something"/>
                </tree>`,
        mockRPC: async (route, args) => {
            assert.step(args.method);
            if (route.startsWith("/web/dataset/call_button")) {
                return true;
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    await contains(".o_data_row [name='foo'] input").edit("plop");
    expect(target.querySelector(".o_data_row [name='foo'] input").value).toBe("plop");

    await click(target.querySelector(".o_data_row button"));
    expect(target.querySelector(".o_data_row [name='foo']").textContent).toBe("plop");

    expect(["get_views", "web_search_read", "web_save", "toDo", "web_search_read"]).toVerifySteps();
});

test("list view: action button executes action on click: correct parameters", async () => {
    assert.expect(6);

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <header>
                            <button name="x" type="object" class="plaf" string="plaf" context="{'plouf': 'plif'}"/>
                    </header>
                    <field name="foo" />
                </tree>`,
        context: {
            paf: "pif",
        },
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: async (params) => {
            const { buttonContext, context, name, resModel, resIds, type } = params;
            // Action's own properties
            expect(name).toBe("x");
            expect(type).toBe("object");

            // The action's execution context
            assert.deepEqual(buttonContext, {
                active_domain: [],
                // active_id: 1, //FGE TODO
                active_ids: [1],
                active_model: "foo",
                plouf: "plif",
            });

            expect(resModel).toBe("foo");
            expect([...resIds]).toEqual([1]);
            assert.deepEqual(context, {
                lang: "en",
                paf: "pif",
                tz: "taht",
                uid: 7,
            });
        },
    });
    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));
    const cpButtons = getVisibleButtons(target);
    await click(cpButtons[1]);
});

test("list view: action button executes action on click with domain selected: correct parameters", async () => {
    assert.expect(12);

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree limit="1">
                    <header>
                            <button name="x" type="object" class="plaf" string="plaf"/>
                    </header>
                    <field name="foo" />
                </tree>`,
        mockRPC(route, args) {
            if (args.method === "search") {
                assert.step("search");
                expect(args.model).toBe("foo");
                expect(args.args).toEqual([[]]); // empty domain since no domain in searchView
            }
        },
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: async (params) => {
            const { buttonContext, context, name, resModel, resIds, type } = params;
            assert.step("execute_action");
            // Action's own properties
            expect(name).toBe("x");
            expect(type).toBe("object");

            // The action's execution context
            assert.deepEqual(buttonContext, {
                active_domain: [],
                // active_id: 1, // FGE TODO
                active_ids: [1, 2, 3, 4],
                active_model: "foo",
            });

            assert.deepEqual(context, {
                lang: "en",
                tz: "taht",
                uid: 7,
            });
            expect(resModel).toBe("foo");
            expect([...resIds]).toEqual([1, 2, 3, 4]);
        },
    });
    await click(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]'));

    await click(target.querySelector(".o_list_select_domain"));
    expect([]).toVerifySteps();

    await click(target.querySelector('button[name="x"]'));
    expect(["search", "execute_action"]).toVerifySteps();
});

test("column names (noLabel, label, string and default)", async () => {
    const fieldRegistry = registry.category("fields");
    const charField = fieldRegistry.get("char");

    class NoLabelCharField extends charField.component {}
    fieldRegistry.add("nolabel_char", {
        ...charField,
        component: NoLabelCharField,
        noLabel: true,
    });

    class LabelCharField extends charField.component {}
    fieldRegistry.add("label_char", {
        ...charField,
        component: LabelCharField,
        label: "Some static label",
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="display_name" widget="nolabel_char" optional="show"/>
                <field name="foo" widget="label_char" optional="show"/>
                <field name="int_field" string="My custom label" optional="show"/>
                <field name="text" optional="show"/>
            </tree>`,
    });

    const columnLabels = [...target.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(columnLabels).toEqual(["", "", "Some static label", "My custom label", "text field", ""]);

    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    const optionalColumnLabels = [...target.querySelectorAll(".o-dropdown--menu .dropdown-item")].map((item) => item.textContent.trim());
    expect(optionalColumnLabels).toEqual(["Display Name", "Some static label", "My custom label", "text field"]);
});

test("simple editable rendering", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
    });

    expect("th").toHaveCount(3, { message: "should have 2 th" });
    expect("th").toHaveCount(3, { message: "should have 3 th" });
    expect(".o_list_record_selector input:enabled").toHaveCount(5);
    expect("td:contains(yop)").toHaveCount(1, { message: "should contain yop" });

    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
    expect(".o_list_button_save").toHaveCount(0);
    expect(".o_list_button_discard").toHaveCount(0);

    await click(target.querySelector(".o_field_cell"));

    expect(".o_list_button_add").toHaveCount(0);
    expect(".o_list_button_save").toHaveCount(2, { message: "Should have 2 save button (small and xl screens)" });
    expect(".o_list_button_discard").toHaveCount(2, { message: "Should have 2 discard button (small and xl screens)" });
    expect(".o_list_record_selector input:enabled").toHaveCount(0);

    await click($(".o_list_button_save:visible").get(0));

    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
    expect(".o_list_button_save").toHaveCount(0);
    expect(".o_list_button_discard").toHaveCount(0);
    expect(".o_list_record_selector input:enabled").toHaveCount(5);
});

test("editable rendering with handle and no data", async () => {
    serverData.models.foo.records = [];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="int_field" widget="handle"/>
                <field name="currency_id"/>
                <field name="m2o"/>
            </tree>`,
    });
    expect("thead th").toHaveCount(4, { message: "there should be 4 th" });
    expect("thead th").toHaveClass("o_list_record_selector");
    expect("thead th").toHaveClass("o_handle_cell");
    expect(target.querySelectorAll("thead th")[1].innerText).toBe("", { message: "the handle field shouldn't have a header description" });
    expect(target.querySelectorAll("thead th")[2].getAttribute("style")).toBe("width: 50%;");
    expect(target.querySelectorAll("thead th")[3].getAttribute("style")).toBe("width: 50%;");
});

test("invisible columns are not displayed", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="bar" column_invisible="1"/>
            </tree>`,
    });

    // 1 th for checkbox, 1 for 1 visible column
    expect("th").toHaveCount(2, { message: "should have 2 th" });
});

test("invisible column based on the context are correctly displayed", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="date" column_invisible="True"/>
                <field name="foo" column_invisible="context.get('notInvisible')"/>
                <field name="bar" column_invisible="context.get('invisible')"/>
            </tree>`,
        context: {
            invisible: true,
            notInvisible: false,
        },
    });

    // 1 th for checkbox, 1 for 1 visible column (foo)
    expect("th").toHaveCount(2, { message: "should have 2 th" });
    expect(target.querySelectorAll("th")[1].dataset.name).toBe("foo");
});

test("invisible column based on the context are correctly displayed in o2m", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <sheet>
                        <field name="foo_o2m">
                            <tree>
                                <field name="foo" column_invisible="context.get('notInvisible')"/>
                                <field name="bar" column_invisible="context.get('invisible')"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
        context: {
            invisible: true,
            notInvisible: false,
        },
    });

    // 1 for 1 visible column (foo), 1 th for delete button
    expect("th").toHaveCount(2, { message: "should have 2 th" });
    expect(queryFirst("th").dataset.name).toBe("foo");
});

test("invisible column based on the parent are correctly displayed in o2m", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <sheet>
                        <field name="int_field"/>
                        <field name="m2m" invisible="True"/>
                        <field name="properties" invisible="True"/>
                        <field name="foo_o2m">
                            <tree>
                                <field name="date" column_invisible="True"/>
                                <field name="foo" column_invisible="parent.int_field == 3"/>
                                <field name="bar" column_invisible="parent.int_field == 10"/>
                                <field name="qux" column_invisible="parent.m2m"/>
                                <field name="amount" column_invisible="parent.properties"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
    });

    // 1 for 2 visible column (foo, properties), 1 th for delete button
    expect("th").toHaveCount(3, { message: "should have 3 th" });
    expect(queryFirst("th").dataset.name).toBe("foo");
    expect(target.querySelectorAll("th")[1].dataset.name).toBe("amount");
});

test("save a record with an invisible required field", async () => {
    serverData.models.foo.fields.foo.required = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo" column_invisible="1"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(_, { args, method }) {
            assert.step(method);
            if (method === "web_save") {
                expect(args[1]).toEqual({ int_field: 1, foo: false });
            }
        },
    });
    expect(".o_data_row").toHaveCount(4);
    expect(["get_views", "web_search_read"]).toVerifySteps();

    await click($(".o_list_button_add:visible").get(0));
    await editInput(target, "[name='int_field'] input", 1);
    await contains(".o_list_view").click();
    expect(".o_data_row").toHaveCount(5);
    expect(target.querySelector(".o_data_row [name='int_field']").textContent).toBe("1");
    expect(["onchange", "web_save"]).toVerifySteps();
});

test("multi_edit: edit a required field with an invalid value", async () => {
    serverData.models.foo.fields.foo.required = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });
    expect(".o_data_row").toHaveCount(4);
    expect(["get_views", "web_search_read"]).toVerifySteps();

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    await editInput(target, "[name='foo'] input", "");
    await contains(".o_list_view").click();
    expect(".modal").toHaveCount(1);
    expect(target.querySelector(".modal .btn").textContent).toBe("Ok");

    await click(target.querySelector(".modal .btn"));
    expect(target.querySelector(".o_data_row .o_data_cell[name='foo']").textContent).toBe("yop");
    expect(".o_data_row").toHaveClass("o_data_row_selected");

    expect([]).toVerifySteps();
});

test("multi_edit: clicking on a readonly field switches the focus to the next editable field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="int_field" readonly="1"/>
                <field name="foo" />
            </tree>`,
    });

    const firstRow = target.querySelector(".o_data_row");
    await click(firstRow, ".o_list_record_selector input");

    let intField = firstRow.querySelector("[name='int_field']");
    intField.focus();
    await click(intField);
    expect(document.activeElement.closest(".o_field_widget").getAttribute("name")).toBe("foo");

    intField = firstRow.querySelector("[name='int_field']");
    intField.focus();
    await click(intField);
    expect(document.activeElement.closest(".o_field_widget").getAttribute("name")).toBe("foo");
});

test("save a record with an required field computed by another", async () => {
    serverData.models.foo.onchanges = {
        foo(record) {
            if (record.foo) {
                record.text = "plop";
            }
        },
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="int_field"/>
                <field name="text" required="1"/>
            </tree>`,
    });
    expect(".o_data_row").toHaveCount(4);
    expect(".o_selected_row").toHaveCount(0);

    await click($(".o_list_button_add:visible").get(0));
    await editInput(target, "[name='int_field'] input", 1);
    await contains(".o_list_view").click();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_field_invalid").toHaveCount(1);
    expect(".o_selected_row").toHaveCount(1);

    await contains("[name='foo'] input").edit("hello");
    expect(".o_field_invalid").toHaveCount(0);
    expect(".o_selected_row").toHaveCount(1);

    await contains(".o_list_view").click();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(0);
});

test("boolean field has no title (data-tooltip)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="bar"/></tree>',
    });
    expect(target.querySelector(".o_data_cell").getAttribute("data-tooltip")).toBe(null);
});

test("text field has no title (data-tooltip)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="text"/></tree>',
    });
    expect(target.querySelector(".o_data_cell").getAttribute("data-tooltip")).toBe(null);
});

test("field with nolabel has no title", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo" nolabel="1"/></tree>',
    });
    expect($(target).find("thead tr:first th:eq(1)").text()).toBe("");
});

test("field titles are not escaped", async () => {
    serverData.models.foo.records[0].foo = "<div>Hello</div>";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
    });

    expect($(target).find("tbody tr:first .o_data_cell").text()).toBe("<div>Hello</div>");
    expect($(target).find("tbody tr:first .o_data_cell").attr("data-tooltip")).toBe("<div>Hello</div>");
});

test("record-depending invisible lines are correctly aligned", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="bar" invisible="id == 1"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect(".o_data_row").toHaveCount(4);
    expect(".o_data_row td").toHaveCount(16); // 4 cells per row
    expect(target.querySelectorAll(".o_data_row td")[2].innerHTML).toBe("");
});

test("invisble fields must not have a tooltip", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo" invisible="id == 1"/>
            </tree>`,
    });

    expect(".o_data_row").toHaveCount(4);
    expect(".o_data_row td[data-tooltip]").toHaveCount(3);
});

test("do not perform extra RPC to read invisible many2one fields", async () => {
    serverData.models.foo.fields.m2o.default = 2;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo"/>
                    <field name="m2o" column_invisible="1"/>
                </tree>`,
        mockRPC(route) {
            assert.step(route.split("/").pop());
        },
    });

    await click($(".o_list_button_add:visible").get(0));
    assert.verifySteps(["get_views", "web_search_read", "onchange"], "no nameget should be done");
});

test("editable list datepicker destroy widget (edition)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="date"/>
            </tree>`,
    });

    expect(".o_data_row").toHaveCount(4);

    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);

    await contains(".o_field_date input").click();
    expect(".o_datetime_picker").toHaveCount(1);

    triggerHotkey("Escape");
    await nextTick();

    expect(".o_selected_row").toHaveCount(0);
    expect(".o_data_row").toHaveCount(4);
});

test("editable list datepicker destroy widget (new line)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="top"><field name="date"/></tree>`,
    });

    expect(".o_data_row").toHaveCount(4, { message: "There should be 4 rows" });

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_selected_row").toHaveCount(1);

    await contains(".o_field_date input").click();
    expect(".o_datetime_picker").toHaveCount(1, { message: "datepicker should be opened" });
    await triggerEvent(document.activeElement, null, "keydown", { key: "Escape" });

    expect(".o_selected_row").toHaveCount(0, { message: "the row is no longer in edition" });
    expect(".o_data_row").toHaveCount(4, { message: "There should still be 4 rows" });
});

test("at least 4 rows are rendered, even if less data", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="bar"/></tree>',
        domain: [["bar", "=", true]],
    });

    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
});

test('discard a new record in editable="top" list with less than 4 records', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="bar"/></tree>',
        domain: [["bar", "=", true]],
    });
    expect(".o_data_row").toHaveCount(3);
    expect("tbody tr").toHaveCount(4);

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_data_row").toHaveCount(4);
    expect("tbody tr").toHaveClass("o_selected_row");

    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));
    expect(".o_data_row").toHaveCount(3);
    expect("tbody tr").toHaveCount(4);
    expect("tbody tr").toHaveClass("o_data_row");
});

test("basic grouped list rendering", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
    });

    expect("th:contains(Foo)").toHaveCount(1, { message: "should contain Foo" });
    expect("th:contains(Bar)").toHaveCount(1, { message: "should contain Bar" });
    expect("tr.o_group_header").toHaveCount(2, { message: "should have 2 .o_group_header" });
    expect("th.o_group_name").toHaveCount(2, { message: "should have 2 .o_group_name" });
});

test('basic grouped list rendering with widget="handle" col', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="int_field" widget="handle"/>
                <field name="foo"/>
                <field name="bar"/>
            </tree>`,
        groupBy: ["bar"],
    });

    expect("thead th").toHaveCount(3); // record selector + Foo + Bar
    expect("thead th.o_list_record_selector").toHaveCount(1);
    expect("thead th[data-name=foo]").toHaveCount(1);
    expect("thead th[data-name=bar]").toHaveCount(1);
    expect("thead th[data-name=int_field]").toHaveCount(0);
    expect("tr.o_group_header").toHaveCount(2);
    expect("th.o_group_name").toHaveCount(2);
    expect(".o_group_header th").toHaveCount(2) // group name + colspan 2
    expect(".o_group_header .o_list_number").toHaveCount(0);
});

test("basic grouped list rendering with a date field between two fields with a aggregator", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="int_field"/>
                <field name="date"/>
                <field name="int_field"/>
            </tree>`,
        groupBy: ["bar"],
    });

    expect("thead th").toHaveCount(4); // record selector + Foo + Int + Date + Int
    expect("thead th.o_list_record_selector").toHaveCount(1);
    expect(getNodesTextContent(target.querySelectorAll("thead th"))).toEqual(["", "int_field", "Some Date", "int_field"]);
    expect("tr.o_group_header").toHaveCount(2);
    expect("th.o_group_name").toHaveCount(2);
    expect(getNodesTextContent(target.querySelector(".o_group_header").querySelectorAll("td"))).toEqual(["-4", "", "-4"]);
});

test("basic grouped list rendering 1 col without selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        groupBy: ["bar"],
        allowSelectors: false,
    });

    expect(".o_group_header th").toHaveCount(1);
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("1");
});

test("basic grouped list rendering 1 col with selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        groupBy: ["bar"],
    });

    expect(".o_group_header th").toHaveCount(1);
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("2");
});

test("basic grouped list rendering 2 cols without selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree ><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
        allowSelectors: false,
    });

    expect(".o_group_header th").toHaveCount(2)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("1");
});

test("basic grouped list rendering 3 cols without selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree ><field name="foo"/><field name="bar"/><field name="text"/></tree>',
        groupBy: ["bar"],
        allowSelectors: false,
    });

    expect(".o_group_header th").toHaveCount(2)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("2");
});

test("basic grouped list rendering 2 col with selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree ><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
        allowSelectors: true,
    });

    expect(".o_group_header th").toHaveCount(2)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("2");
});

test("basic grouped list rendering 3 cols with selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/><field name="text"/></tree>',
        groupBy: ["bar"],
        allowSelectors: true,
    });

    expect(".o_group_header th").toHaveCount(2)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("3");
});

test("basic grouped list rendering 7 cols with aggregates and selector", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="datetime"/>
                    <field name="foo"/>
                    <field name="int_field" sum="Sum1"/>
                    <field name="bar"/>
                    <field name="qux" sum="Sum2"/>
                    <field name="date"/>
                    <field name="text"/>
                </tree>`,
        groupBy: ["bar"],
    });

    expect(".o_group_header th,td").toHaveCount(5)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("3");
    expect(".o_group_header td").toHaveCount(3, { message: "there should be 3 tds (aggregates + fields in between)" })
    expect(target.querySelector(".o_group_header th:last-child").getAttribute("colspan")).toBe("2", { message: "header last cell should span on the two last fields (to give space for the pager) (colspan 2)" });
});

test("basic grouped list rendering 7 cols with aggregates, selector and optional", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="datetime"/>
                    <field name="foo"/>
                    <field name="int_field" sum="Sum1"/>
                    <field name="bar"/>
                    <field name="qux" sum="Sum2"/>
                    <field name="date"/>
                    <field name="text" optional="show"/>
                </tree>`,
        groupBy: ["bar"],
    });

    expect(".o_group_header th,td").toHaveCount(5)
    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("3");
    expect(".o_group_header td").toHaveCount(3, { message: "there should be 3 tds (aggregates + fields in between)" })
    expect(target.querySelector(".o_group_header th:last-child").getAttribute("colspan")).toBe("3", { message: "header last cell should span on the two last fields (to give space for the pager) (colspan 2)" });
});

test("basic grouped list rendering 4 cols with aggregates, selector and openFormView", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree open_form_view="True">
                    <field name="datetime"/>
                    <field name="int_field" sum="Sum1"/>
                    <field name="bar"/>
                    <field name="qux" sum="Sum2" optional="hide"/>
                </tree>`,
        groupBy: ["bar"],
    });

    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("2");
    expect(target.querySelector(".o_group_header th:last-child").getAttribute("colspan")).toBe("2");
});

test("basic grouped list rendering 4 cols with aggregates, selector, optional and openFormView", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree open_form_view="True">
                    <field name="datetime"/>
                    <field name="int_field" sum="Sum1"/>
                    <field name="bar"/>
                    <field name="qux" sum="Sum2" optional="show"/>
                </tree>`,
        groupBy: ["bar"],
    });

    expect(target.querySelector(".o_group_header th").getAttribute("colspan")).toBe("2");
    expect(target.querySelector(".o_group_header th:last-child").getAttribute("colspan")).toBe("1");
});

test("group a list view with the aggregable field 'value'", async () => {
    serverData.models.foo.fields.value = {
        string: "Value",
        type: "integer",
        aggregator: "sum",
    };
    for (const record of serverData.models.foo.records) {
        record.value = 1;
    }
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="bar"/>
                    <field name="value" sum="Sum1"/>
                </tree>`,
        groupBy: ["bar"],
    });
    expect(".o_group_header").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll(".o_group_header")].map((el) => el.textContent),
        ["No (1) 1", "Yes (3) 3"]
    );
});

test("basic grouped list rendering with groupby m2m field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        groupBy: ["m2m"],
    });

    expect(".o_group_header").toHaveCount(4, { message: "should contain 4 open groups" });
    expect(".o_group_open").toHaveCount(0, { message: "no group is open" });
    assert.deepEqual(
        [...target.querySelectorAll(".o_group_header .o_group_name")].map((el) => el.innerText),
        ["None (1)", "Value 1 (3)", "Value 2 (2)", "Value 3 (1)"],
        "should have those group headers"
    );

    // Open all groups
    await click(queryFirst(".o_group_name"));
    await click(target.querySelectorAll(".o_group_name")[1]);
    await click(target.querySelectorAll(".o_group_name")[2]);
    await click(target.querySelectorAll(".o_group_name")[3]);
    expect(".o_group_open").toHaveCount(4, { message: "all groups are open" });

    const rows = target.querySelectorAll(".o_list_view tbody > tr");
    assert.deepEqual(
        [...rows].map((el) => el.innerText.replace(/\s/g, "")),
        ["None(1)", "gnap", "Value1(3)", "yopValue1Value2", "blipValue1Value2Value3", "blipValue1", "Value2(2)", "yopValue1Value2", "blipValue1Value2Value3", "Value3(1)", "blipValue1Value2Value3"],
        "should have these row contents"
    );
});

test("grouped list rendering with groupby m2o and m2m field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2o"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        groupBy: ["m2o", "m2m"],
    });

    let rows = target.querySelectorAll("tbody > tr");
    assert.deepEqual(
        [...rows].map((el) => el.innerText.replace(/\s/g, "")),

        ["Value1(3)", "Value2(1)"],
        "should have these row contents"
    );

    await click(target.querySelector("th.o_group_name"));

    rows = target.querySelectorAll("tbody > tr");
    assert.deepEqual(
        [...rows].map((el) => el.innerText.replace(/\s/g, "")),
        ["Value1(3)", "None(1)", "Value1(2)", "Value2(1)", "Value2(1)"],
        "should have these row contents"
    );

    await click(target.querySelectorAll("tbody th.o_group_name")[4]);
    rows = target.querySelectorAll(".o_list_view tbody > tr");

    assert.deepEqual(
        [...rows].map((el) => el.innerText.replace(/\s/g, "")),
        ["Value1(3)", "None(1)", "Value1(2)", "Value2(1)", "Value2(1)", "Value1(1)", "Value2(1)", "Value3(1)"],
        "should have these row contents"
    );
});

test("list view with multiple groupbys", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar", "foo"],
        noContentHelp: "<p>should not be displayed</p>",
    });

    expect(".o_view_nocontent").toHaveCount(0);
    expect(".o_group_has_content").toHaveCount(2);
    expect(getNodesTextContent(target.querySelectorAll(".o_group_has_content"))).toEqual(["No (1) ", "Yes (3) "]);
});

test("deletion of record is disabled when groupby m2m field", async () => {
    patchUserWithCleanup({ hasGroup: () => Promise.resolve(false) });

    serverData.models.foo.fields.m2m.groupable = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        actionMenus: {},
    });
    await groupByMenu(target, "m2m");

    await click(target.querySelector(".o_group_header:first-child")); // open first group
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("div.o_control_panel .o_cp_action_menus .dropdown-toggle").toHaveCount(0, { message: "should not have dropdown as delete item is not there" });

    // unselect group by m2m (need to unselect record first)
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    await contains(".o_searchview .o_facet_remove").click();

    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("div.o_control_panel .o_cp_action_menus .dropdown-toggle").toHaveCount(1);
    await contains("div.o_control_panel .o_cp_action_menus .dropdown-toggle").click();
    assert.deepEqual(
        [...target.querySelectorAll(".o-dropdown--menu .o_menu_item")].map((el) => el.innerText),
        ["Duplicate", "Delete"]
    );
});

test("add record in list grouped by m2m", async () => {
    assert.expect(7);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        groupBy: ["m2m"],
        mockRPC(route, args) {
            if (args.method === "onchange") {
                expect(args.kwargs.context.default_m2m).toEqual([1]);
            }
        },
    });

    expect(".o_group_header").toHaveCount(4);
    expect(getNodesTextContent(target.querySelectorAll(".o_group_header"))).toEqual(["None (1) ", "Value 1 (3) ", "Value 2 (2) ", "Value 3 (1) "]);

    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(".o_data_row").toHaveCount(3);

    await contains(".o_group_field_row_add a").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_selected_row .o_field_tags .o_tag").toHaveCount(1);
    expect(target.querySelector(".o_selected_row .o_field_tags .o_tag").innerText).toBe("Value 1");
});

test("editing a record should change same record in other groups when grouped by m2m field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="m2m" widget="many2many_tags"/>
                </tree>`,
        groupBy: ["m2m"],
    });
    await click(target.querySelectorAll(".o_group_header")[1]); // open Value 1 group
    await click(target.querySelectorAll(".o_group_header")[2]); // open Value 2 group
    const rows = target.querySelectorAll(".o_data_row");
    expect(rows[0].querySelector(".o_list_char").textContent).toBe("yop");
    expect(rows[3].querySelector(".o_list_char").textContent).toBe("yop");

    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_data_cell"));
    await editInput(rows[0], ".o_data_row .o_list_char input", "xyz");
    await contains(".o_list_view").click();
    expect(rows[0].querySelector(".o_list_char").textContent).toBe("xyz");
    expect(rows[3].querySelector(".o_list_char").textContent).toBe("xyz");
});

test("change a record field in readonly should change same record in other groups when grouped by m2m field", async () => {
    assert.expect(6);

    serverData.models.foo.fields.priority = {
        string: "Priority",
        type: "selection",
        selection: [
            [0, "Not Prioritary"],
            [1, "Prioritary"],
        ],
        default: 0,
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="foo"/>
                    <field name="priority" widget="priority"/>
                    <field name="m2m" widget="many2many_tags"/>
                </tree>`,
        groupBy: ["m2m"],
        domain: [["m2o", "=", 1]],
        mockRPC(route, args) {
            if (args.method === "web_save") {
                expect(args.args[0]).toEqual([1], { message: "should write on the correct record" });
                assert.deepEqual(
                    args.args[1],
                    {
                        priority: 1,
                    },
                    "should write these changes"
                );
            }
        },
    });

    await click(target.querySelectorAll(".o_group_header")[1]); // open Value 1 group
    await click(target.querySelectorAll(".o_group_header")[2]); // open Value 2 group
    const rows = target.querySelectorAll(".o_data_row");
    expect(rows[0].querySelector(".o_list_char").textContent).toBe("yop");
    expect(rows[2].querySelector(".o_list_char").textContent).toBe("yop");
    expect(".o_priority_star.fa-star").toHaveCount(0, { message: "should not have any starred records" });

    await click(rows[0].querySelector(".o_priority_star"));
    expect(".o_priority_star.fa-star").toHaveCount(2, { message: "both 'yop' records should have been starred" });
});

test("ordered target, sort attribute in context", async () => {
    serverData.models.foo.fields.foo.sortable = true;
    serverData.models.foo.fields.date.sortable = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="date"/></tree>',
        mockRPC: (route, args) => {
            if (args.method === "create_or_replace") {
                const favorite = args.args[0];
                assert.step(favorite.sort);
                return 7;
            }
        },
    });

    // Descending order on Foo
    await contains("th.o_column_sortable[data-name=foo]").click();
    await contains("th.o_column_sortable[data-name=foo]").click();

    // Ascending order on Date
    await contains("th.o_column_sortable[data-name=date]").click();

    await toggleSearchBarMenu(target);
    await toggleSaveFavorite(target);
    await editFavoriteName(target, "My favorite");
    await saveFavorite(target);

    assert.verifySteps(['["date","foo desc"]']);
});

test("Loading a filter with a sort attribute", async () => {
    assert.expect(2);

    serverData.models.foo.fields.foo.sortable = true;
    serverData.models.foo.fields.date.sortable = true;

    let searchReads = 0;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="date"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                if (searchReads === 0) {
                    expect(args.kwargs.order).toBe("date ASC, foo DESC", { message: "The sort attribute of the filter should be used by the initial search_read" });
                } else if (searchReads === 1) {
                    expect(args.kwargs.order).toBe("date DESC, foo ASC", { message: "The sort attribute of the filter should be used by the next search_read" });
                }
                searchReads += 1;
            }
        },
        irFilters: [
            {
                context: "{}",
                domain: "[]",
                id: 7,
                is_default: true,
                name: "My favorite",
                sort: '["date asc", "foo desc"]',
                user_id: [2, "Mitchell Admin"],
            },
            {
                context: "{}",
                domain: "[]",
                id: 8,
                is_default: false,
                name: "My second favorite",
                sort: '["date desc", "foo asc"]',
                user_id: [2, "Mitchell Admin"],
            },
        ],
    });

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "My second favorite");
});

test("many2one field rendering", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="m2o"/></tree>',
    });

    assert.ok($(target).find("td:contains(Value 1)").length, "should have the display_name of the many2one");
});

test("many2one field rendering with many2one widget", async () => {
    serverData.models.bar.records[0].display_name = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="m2o" widget="many2one"/></tree>',
    });

    assert.ok($(target).find("td:contains(Unnamed)").length, "should have a Unnamed as fallback of many2one display_name");
});

test("many2one field rendering when display_name is falsy", async () => {
    serverData.models.bar.records[0].display_name = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="m2o"/></tree>',
        mockRPC(route) {
            assert.step(route);
        },
    });

    assert.ok($(target).find("td:contains(Unnamed)").length, "should have a Unnamed as fallback of many2one display_name");
    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
});

test("grouped list view, with 1 open group", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="int_field"/></tree>',
        groupBy: ["foo"],
    });

    expect("tr.o_group_header").toHaveCount(3);
    expect("tr.o_data_row").toHaveCount(0);

    await click(target.querySelector("th.o_group_name"));
    await nextTick();
    expect("tr.o_group_header").toHaveCount(3);
    expect("tr.o_data_row").toHaveCount(2);
    expect("td:contains(9)").toHaveCount(1, { message: "should contain 9" });
    expect("td:contains(-4)").toHaveCount(1, { message: "should contain -4" });
    expect("td:contains(10)").toHaveCount(1, { message: "should contain 10" }); // FIXME: missing aggregates
    expect("tr.o_group_header td:contains(10)").toHaveCount(1, { message: "but 10 should be in a header" });
});

test("opening records when clicking on record", async () => {
    assert.expect(6);

    const listView = registry.category("views").get("list");
    class CustomListController extends listView.Controller {
        openRecord(record) {
            assert.step("openRecord");
            expect(record.resId).toBe(2);
        }
    }
    registry.category("views").add("custom_list", {
        ...listView,
        Controller: CustomListController,
    });

    serverData.models.foo.fields.foo.groupable = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree js_class="custom_list"><field name="foo"/></tree>',
    });

    await click(target.querySelector("tr:nth-child(2) td:not(.o_list_record_selector)"));
    await groupByMenu(target, "foo");

    expect("tr.o_group_header").toHaveCount(3, { message: "list should be grouped" });
    await click(target.querySelector("th.o_group_name"));

    await click(target.querySelector("tr:not(.o_group_header) td:not(.o_list_record_selector)"));
    expect(["openRecord", "openRecord"]).toVerifySteps();
});

test("execute an action before and after each valid save in a list view", async () => {
    const listView = registry.category("views").get("list");
    class CustomListController extends listView.Controller {
        async onRecordSaved(record) {
            assert.step(`onRecordSaved ${record.resId}`);
        }

        async onWillSaveRecord(record) {
            assert.step(`onWillSaveRecord ${record.resId}`);
        }
    }
    registry.category("views").add(
        "custom_list",
        {
            ...listView,
            Controller: CustomListController,
        },
        { force: true }
    );

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree js_class="custom_list" editable="top"><field name="foo" required="1"/></tree>',
        mockRPC: async (route, args) => {
            if (args.method === "web_save") {
                assert.step(`web_save ${args.args[0]}`);
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, "[name='foo'] input", "");
    await contains(".o_list_view").click();
    expect([]).toVerifySteps();

    await contains("[name='foo'] input").edit("YOLO");
    await contains(".o_list_view").click();
    expect(["onWillSaveRecord 1", "web_save 1", "onRecordSaved 1"]).toVerifySteps();
});

test("execute an action before and after each valid save in a grouped list view", async () => {
    const listView = registry.category("views").get("list");
    class CustomListController extends listView.Controller {
        async onRecordSaved(record) {
            assert.step(`onRecordSaved ${record.resId}`);
        }

        async onWillSaveRecord(record) {
            assert.step(`onWillSaveRecord ${record.resId}`);
        }
    }
    registry.category("views").add("custom_list", {
        ...listView,
        Controller: CustomListController,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree js_class="custom_list" editable="top" expand="1"><field name="foo" required="1"/></tree>',
        groupBy: ["bar"],
        mockRPC: async (route, args) => {
            if (args.method === "web_save") {
                assert.step(`web_save ${args.args[0]}`);
            }
        },
    });

    await click(target.querySelector(".o_data_cell[name='foo']"));
    await editInput(target, "[name='foo'] input", "");
    await contains(".o_list_view").click();
    expect([]).toVerifySteps();

    await contains("[name='foo'] input").edit("YOLO");
    await contains(".o_list_view").click();
    expect(["onWillSaveRecord 4", "web_save 4", "onRecordSaved 4"]).toVerifySteps();
});

test("don't exec a valid save with onWillSaveRecord in a list view", async () => {
    const listView = registry.category("views").get("list");
    class ListViewCustom extends listView.Controller {
        async onRecordSaved(record) {
            throw new Error("should not execute onRecordSaved");
        }

        async onWillSaveRecord(record) {
            assert.step(`onWillSaveRecord ${record.resId}`);
            return false;
        }
    }
    registry.category("views").add(
        "list",
        {
            ...listView,
            Controller: ListViewCustom,
        },
        { force: true }
    );

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo" required="1"/></tree>',
        mockRPC: async (route, args) => {
            if (args.method === "write") {
                throw new Error("should not save the record");
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, "[name='foo'] input", "");
    await contains(".o_list_view").click();
    expect([]).toVerifySteps();

    await click(target.querySelector(".o_data_cell"));
    await contains("[name='foo'] input").edit("YOLO");
    await contains(".o_list_view").click();
    expect(["onWillSaveRecord 1"]).toVerifySteps();
});

test("action/type attributes on tree arch, type='object'", async () => {
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree action="a1" type="object"><field name="foo"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    patchWithCleanup(list.env.services.action, {
        doActionButton(params) {
            assert.step(`doActionButton type ${params.type} name ${params.name}`);
            params.onClose();
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();
    await click(target.querySelector(".o_data_cell"));
    expect(["doActionButton type object name a1", "web_search_read"]).toVerifySteps();
});

test("action/type attributes on tree arch, type='action'", async () => {
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree action="a1" type="action"><field name="foo"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    patchWithCleanup(list.env.services.action, {
        doActionButton(params) {
            assert.step(`doActionButton type ${params.type} name ${params.name}`);
            params.onClose();
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();
    await click(target.querySelector(".o_data_cell"));
    expect(["doActionButton type action name a1", "web_search_read"]).toVerifySteps();
});

test("editable list view: readonly fields cannot be edited", async () => {
    serverData.models.foo.fields.foo.readonly = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field" readonly="1"/>
            </tree>`,
    });
    await click(target.querySelector(".o_field_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row", { message: "row should be in edit mode" });
    expect(".o_field_widget[name=foo]").toHaveClass("o_readonly_modifier", { message: "foo field should be readonly in edit mode" });
    expect(".o_field_widget[name=bar]").not.toHaveClass("o_readonly_modifier", { message: "bar field should be editable" });
    expect(".o_field_widget[name=int_field]").toHaveClass("o_readonly_modifier", { message: "int_field field should be readonly in edit mode" });
    expect(".o_data_cell").toHaveClass("o_readonly_modifier");
});

test("editable list view: line with no active element", async () => {
    serverData.models.bar = {
        fields: {
            titi: { string: "Char", type: "char" },
            grosminet: { string: "Bool", type: "boolean" },
        },
        records: [
            { id: 1, titi: "cui", grosminet: true },
            { id: 2, titi: "cuicui", grosminet: false },
        ],
    };
    serverData.models.foo.records[0].o2m = [1, 2];

    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
            <form>
                <field name="o2m">
                    <tree editable="top">
                        <field name="titi" readonly="1"/>
                        <field name="grosminet" widget="boolean_toggle"/>
                    </tree>
                </field>
            </form>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
            }
        },
    });

    expect(".o_data_cell").toHaveClass("o_boolean_toggle_cell");

    await click(queryFirst(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    assert.containsOnce(queryFirst(".o_data_cell"), ".o_readonly_modifier");
    await click(target.querySelectorAll(".o_data_cell")[1], ".o_boolean_toggle input");
    expect([]).toVerifySteps();
});

test("editable list view: click on last element after creation empty new line", async () => {
    serverData.models.bar = {
        fields: {
            titi: { string: "Char", type: "char", required: true },
            int_field: {
                string: "int_field",
                type: "integer",
                sortable: true,
                required: true,
            },
        },
        records: [
            { id: 1, titi: "cui", int_field: 2 },
            { id: 2, titi: "cuicui", int_field: 4 },
        ],
    };
    serverData.models.foo.records[0].o2m = [1, 2];

    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <field name="o2m">
                        <tree editable="top">
                        <field name="int_field" widget="handle"/>
                        <field name="titi"/>
                        </tree>
                    </field>
                </form>`,
    });
    await addRow(target);
    await click([...target.querySelectorAll(".o_data_row")].pop().querySelector("td.o_list_char"));
    // This test ensure that they aren't traceback when clicking on the last row.
    expect(".o_data_row").toHaveCount(2, { message: "list should have exactly 2 rows" });
});

test("edit field in editable field without editing the row", async () => {
    // some widgets are editable in readonly (e.g. priority, boolean_toggle...) and they
    // thus don't require the row to be switched in edition to be edited
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="bar" widget="boolean_toggle"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save: " + args.args[1].bar);
            }
        },
    });

    // toggle the boolean value of the first row without editing the row
    assert.ok(target.querySelector(".o_data_row .o_boolean_toggle input").checked);
    expect(".o_selected_row").toHaveCount(0);
    await click(target.querySelector(".o_data_row .o_boolean_toggle input"));
    assert.notOk(target.querySelector(".o_data_row .o_boolean_toggle input").checked);
    expect(".o_selected_row").toHaveCount(0);
    expect(["web_save: false"]).toVerifySteps();

    // toggle the boolean value after switching the row in edition
    expect(".o_selected_row").toHaveCount(0);
    await click(target.querySelector(".o_data_row .o_data_cell .o_field_boolean_toggle div"));
    expect(".o_selected_row").toHaveCount(1);
    await click(target.querySelector(".o_selected_row .o_field_boolean_toggle div"));
    expect(["web_save: true"]).toVerifySteps();
});

test("basic operations for editable list renderer", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
    });

    expect(".o_data_row").toHaveCount(4);
    expect(".o_data_row .o_selected_row").toHaveCount(0);
    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
});

test("editable list: add a line and discard", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
        domain: [["foo", "=", "yop"]],
    });

    expect("tbody tr").toHaveCount(4, { message: "list should contain 4 rows" });
    expect(".o_data_row").toHaveCount(1, { message: "list should contain one record (and thus 3 empty rows)" });

    expect(target.querySelector(".o_pager_value").innerText).toBe("1-1", { message: "pager should be correct" });

    await click($(".o_list_button_add:visible").get(0));

    expect("tbody tr").toHaveCount(4, { message: "list should still contain 4 rows" });
    expect(".o_data_row").toHaveCount(2, { message: "list should contain two record (and thus 2 empty rows)" });
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2", { message: "pager should be correct" });

    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));

    expect("tbody tr").toHaveCount(4, { message: "list should still contain 4 rows" });
    expect(".o_data_row").toHaveCount(1, { message: "list should contain one record (and thus 3 empty rows)" });
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-1", { message: "pager should be correct" });
});

test("field changes are triggered correctly", async () => {
    serverData.models.foo.onchanges = {
        foo: function () {
            assert.step("onchange");
        },
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
    });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    await contains(".o_field_widget[name=foo] input").edit("abc");
    expect(["onchange"]).toVerifySteps();
    await click(target.querySelectorAll(".o_data_cell")[2]);
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect([]).toVerifySteps();
});

test("editable list view: basic char field edition", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
    });

    await click(target.querySelector(".o_field_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    await contains(".o_field_char input").edit("abc");
    expect(target.querySelector(".o_field_char input").value).toBe("abc", { message: "char field has been edited correctly" });

    await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
    expect(target.querySelector(".o_field_cell").innerText).toBe("abc", { message: "changes should be saved correctly" });
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(".o_data_row").not.toHaveClass("o_selected_row", { message: "saved row should be in readonly mode" });
    expect(serverData.models.foo.records[0].foo).toBe("abc", { message: "the edition should have been properly saved" });
});

test("editable list view: save data when list sorting in edit mode", async () => {
    assert.expect(2);

    serverData.models.foo.fields.foo.sortable = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_save") {
                expect(args.args).toEqual([[1], { foo: "xyz" }], { message: "should correctly save the edited record" });
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_field_widget[name="foo"] input', "xyz");
    await click(target.querySelector(".o_column_sortable"));
    expect(".o_selected_row").toHaveCount(0);
});

test("editable list view: check that controlpanel buttons are updating when groupby applied", async () => {
    serverData.models.foo.fields.foo = { string: "Foo", type: "char", required: true };
    serverData.actions = {
        11: {
            id: 11,
            name: "Partners Action 11",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [9, "search"],
        },
    };
    serverData.views = {
        "foo,3,list": '<tree editable="top"><field name="display_name"/><field name="foo"/></tree>',

        "foo,9,search": `
                <search>
                    <filter string="candle" name="itsName" context="{'group_by': 'foo'}"/>
                </search>`,
    };

    const webClient = await createWebClient({ serverData });

    await doAction(webClient, 11);
    await click($(".o_list_button_add:visible").get(0));

    expect(".o_list_button_add").toHaveCount(0);
    expect(".o_list_button_save").toHaveCount(2, { message: "Should have 2 save button (small and xl screens)" });

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "candle");

    expect(".o_list_button_add:visible").toHaveCount(1, { message: "Create available as list is grouped" });
    expect(".o_list_button_save").toHaveCount(0, { message: "Save not available as no row in edition" });
});

test("editable list view: check that add button is present when groupby applied", async () => {
    assert.expect(4);

    serverData.models.foo.fields.foo = { string: "Foo", type: "char", required: true };
    serverData.actions = {
        11: {
            id: 11,
            name: "Partners Action 11",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [
                [3, "list"],
                [4, "form"],
            ],
            search_view_id: [9, "search"],
        },
    };
    serverData.views = {
        "foo,3,list": '<tree editable="top"><field name="display_name"/><field name="foo"/></tree>',
        "foo,4,form": '<form><field name="display_name"/><field name="foo"/></form>',
        "foo,9,search": `
                <search>
                    <filter string="candle" name="itsName" context="{'group_by': 'foo'}"/>
                </search>`,
    };

    const webClient = await createWebClient({ serverData });
    await doAction(webClient, 11);

    expect(".o_list_button_add:visible").toHaveCount(1);
    await click(target.querySelector(".o_searchview_dropdown_toggler"));
    await click($(target).find('.o_menu_item:contains("candle")')[0]);
    expect(".o_list_button_add:visible").toHaveCount(1);

    expect(".o_list_view").toHaveCount(1);
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_form_view").toHaveCount(1);
});

test("list view not groupable", async () => {
    serverData.views = {
        "foo,false,search": `
            <search>
                <filter context="{'group_by': 'foo'}" name="foo"/>
            </search>`,
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="display_name"/>
                <field name="foo"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "read_group") {
                throw new Error("Should not do a read_group RPC");
            }
        },
        searchMenuTypes: ["filter", "favorite"],
        context: { search_default_foo: 1 },
    });

    expect(".o_control_panel div.o_search_options div.o_group_by_menu").toHaveCount(0, { message: "there should not be groupby menu" });
    expect(getFacetTexts(target)).toEqual([]);
});

test("selection changes are triggered correctly", async () => {
    patchWithCleanup(ListController.prototype, {
        setup() {
            super.setup(...arguments);
            onRendered(() => {
                assert.step("onRendered ListController");
            });
        },
    });

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
    });
    var tbody_selector = target.querySelector("tbody .o_list_record_selector input");
    var thead_selector = target.querySelector("thead .o_list_record_selector input");

    expect(list.model.root.selection.length).toBe(0, { message: "no record should be selected" });
    assert.notOk(tbody_selector.checked, "selection checkbox should be checked");
    expect(["onRendered ListController"]).toVerifySteps();

    // tbody checkbox click
    await click(tbody_selector);
    expect(list.model.root.selection.length).toBe(1, { message: "only 1 record should be selected" });
    assert.deepEqual(
        list.model.root.selection[0].data,
        {
            bar: true,
            foo: "yop",
        },
        "the correct record should be selected"
    );
    assert.ok(tbody_selector.checked, "selection checkbox should be checked");
    expect(["onRendered ListController"]).toVerifySteps();

    await click(tbody_selector);
    expect(list.model.root.selection.length).toBe(0, { message: "no record should be selected" });
    assert.notOk(tbody_selector.checked, "selection checkbox should be checked");
    expect(["onRendered ListController"]).toVerifySteps();

    // head checkbox click
    await click(thead_selector);
    expect(list.model.root.selection.length).toBe(4, { message: "all records should be selected" });
    assert.containsN(target, "tbody .o_list_record_selector input:checked", target.querySelectorAll("tbody tr").length, "all selection checkboxes should be checked");
    expect(["onRendered ListController"]).toVerifySteps();

    await click(thead_selector);
    expect(list.model.root.selection.length).toBe(0, { message: "no records should be selected" });
    expect("tbody .o_list_record_selector input:checked").toHaveCount(0, { message: "no selection checkbox should be checked" });
    expect(["onRendered ListController"]).toVerifySteps();
});

test("Row selection checkbox can be toggled by clicking on the cell", async () => {
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
    });

    expect(list.model.root.selection.length).toBe(0, { message: "no record should be selected" });

    await click(target.querySelector("tbody .o_list_record_selector"));
    expect("tbody .o_list_record_selector input:checked").toHaveCount(1);
    expect(list.model.root.selection.length).toBe(1, { message: "only 1 record should be selected" });
    await click(target.querySelector("tbody .o_list_record_selector"));
    expect(".o_list_record_selector input:checked").toHaveCount(0);
    expect(list.model.root.selection.length).toBe(0, { message: "no record should be selected" });

    await click(target.querySelector("thead .o_list_record_selector"));
    expect(".o_list_record_selector input:checked").toHaveCount(5);
    expect(list.model.root.selection.length).toBe(4, { message: "all records should be selected" });
    await click(target.querySelector("thead .o_list_record_selector"));
    expect(".o_list_record_selector input:checked").toHaveCount(0);
    expect(list.model.root.selection.length).toBe(0, { message: "no record should be selected" });
});

test("head selector is toggled by the other selectors", async () => {
    await mountView({
        type: "list",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
        resModel: "foo",
    });

    assert.notOk(target.querySelector("thead .o_list_record_selector input").checked, "Head selector should be unchecked");

    await click(target.querySelector(".o_group_header:nth-child(2)"));
    await click(target.querySelector("thead .o_list_record_selector input"));
    expect("tbody .o_list_record_selector input:checked").toHaveCount(3, { message: "All visible checkboxes should be checked" });

    await click(target.querySelector(".o_group_header:first-child"));
    assert.notOk(target.querySelector("thead .o_list_record_selector input").checked, "Head selector should be unchecked");

    await click(target.querySelector("tbody:nth-child(2) .o_list_record_selector input"));
    assert.ok(target.querySelector("thead .o_list_record_selector input").checked, "Head selector should be checked");

    await click(target.querySelector("tbody .o_list_record_selector input"));

    assert.notOk(target.querySelector("thead .o_list_record_selector input").checked, "Head selector should be unchecked");

    await click(target.querySelector(".o_group_header"));

    assert.ok(target.querySelector("thead .o_list_record_selector input").checked, "Head selector should be checked");
});

test("selection box is properly displayed (single page)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
    });

    expect(".o_data_row").toHaveCount(4);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);

    // select a record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("1 selected");

    // select all records of first page
    await click(target.querySelector("thead .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("4 selected");

    // unselect a record
    await click(target.querySelectorAll(".o_data_row .o_list_record_selector input")[1]);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("3 selected");
    await click(target.querySelector(".o_list_unselect_all"));
    expect(".o_list_selection_box").toHaveCount(0, { message: "selection options are no longer visible" });
    expect(".o_data_row .o_list_record_selector input:checked").toHaveCount(0, { message: "no records should be selected" });
});

test("selection box is properly displayed (multi pages)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="3"><field name="foo"/><field name="bar"/></tree>',
    });

    expect(".o_data_row").toHaveCount(3);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);

    // select a record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("1 selected");

    // select all records of first page
    await click(target.querySelector("thead .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);
    expect(target.querySelector(".o_list_selection_box").textContent.replace(/\s+/g).toBe(" ").trim(), { message: "3 selected Select all 4" });

    // select all domain
    await click(target.querySelector(".o_list_selection_box .o_list_select_domain"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(queryText(".o_list_selection_box")).toBe("All 4 selected");
    await click(target.querySelector(".o_list_unselect_all"));
    expect(".o_list_selection_box").toHaveCount(0, { message: "selection options are no longer visible" });
});

test("selection box is properly displayed (group list)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["foo"],
    });
    expect(".o_group_header").toHaveCount(3);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);

    // open first group
    await click(target.querySelector(".o_group_header"));

    // select a record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);
    expect(queryText(".o_list_selection_box")).toBe("1 selected");

    // select all records of first page
    await click(target.querySelector("thead .o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);
    expect(target.querySelector(".o_list_selection_box").textContent.replace(/\s+/g).toBe(" ").trim(), { message: "2 selected Select all 4" });

    // select all domain
    await click(target.querySelector(".o_list_selection_box .o_list_select_domain"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect(queryText(".o_list_selection_box")).toBe("All 4 selected");
    await click(target.querySelector(".o_list_unselect_all"));
    expect(".o_list_selection_box").toHaveCount(0, { message: "selection options are no longer visible" });
});

test("selection box is displayed as first action button", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <header>
                        <button name="x" type="object" class="plaf" string="plaf"/>
                        <button name="y" type="object" class="plouf" string="plouf"/>
                </header>
                <field name="foo"/>
                <field name="bar"/>
            </tree>`,
    });

    expect(".o_data_row").toHaveCount(4);
    assert.containsNone($(target).find(".o_control_panel_actions"), ".o_list_selection_box");

    // select a record
    await contains(".o_data_row:first-child .o_list_record_selector input").click();
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    const firstElement = target.querySelector(".o_control_panel_actions > div").firstElementChild;
    expect(firstElement).toBe(target.querySelector(".o_control_panel_actions .o_list_selection_box"), { message: "last element should selection box" });
    expect(queryText(".o_list_selection_box")).toBe("1 selected");
});

test("selection box is not removed after multi record edition", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree multi_edit="1"><field name="foo"/><field name="bar"/></tree>',
    });

    expect(".o_data_row").toHaveCount(4, { message: "there should be 4 records" });
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0, { message: "list selection box should not be displayed" })

    // select all records
    await click(target.querySelector(".o_list_record_selector input"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1, { message: "list selection box should be displayed" });
    expect(".o_data_row .o_list_record_selector input:checked").toHaveCount(4, { message: "all 4 records should be selected" });

    // edit selected records
    await click(target.querySelector(".o_data_row").querySelector(".o_data_cell"));
    await contains(".o_data_row [name=foo] input").edit("legion");
    await contains(".modal-dialog button.btn-primary").click();
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1, { message: "list selection box should still be displayed" });
    expect(".o_data_row .o_list_record_selector input:checked").toHaveCount(4, { message: "same records should be selected" });
});

test("selection is reset on reload", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
            </tree>`,
    });

    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);
    expect($(target).find("tfoot td:nth(2)").text()).toBe("32", { message: "total should be 32 (no record selected)" });

    // select first record
    var firstRowSelector = target.querySelector("tbody .o_list_record_selector input");
    await click(firstRowSelector);
    assert.ok(firstRowSelector.checked, "first row should be selected");
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
    expect($(target).find("tfoot td:nth(2)").text()).toBe("10", { message: "total should be 10 (first record selected)" });

    await reloadListView(target);
    firstRowSelector = target.querySelector("tbody .o_list_record_selector input");
    assert.notOk(firstRowSelector.checked, "first row should no longer be selected");
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);
    expect($(target).find("tfoot td:nth(2)").text()).toBe("32", { message: "total should be 32 (no more record selected)" });
});

test("selection is kept on render without reload", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["foo"],
        actionMenus: {},
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
            </tree>`,
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);

    // open blip grouping and check all lines
    await click($(target).find('.o_group_header:contains("blip (2)")')[0]);
    await click(target.querySelector(".o_data_row input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);

    // open yop grouping and verify blip are still checked
    await click($(target).find('.o_group_header:contains("yop (1)")')[0]);
    expect(".o_data_row input:checked").toHaveCount(1, { message: "opening a grouping does not uncheck others" });
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);

    // close and open blip grouping and verify blip are unchecked
    await click($(target).find('.o_group_header:contains("blip (2)")')[0]);
    await click($(target).find('.o_group_header:contains("blip (2)")')[0]);
    expect(".o_data_row input:checked").toHaveCount(0, { message: "opening and closing a grouping uncheck its elements" });
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);
});

test("select a record in list grouped by date with granularity", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["date:year"],
        // keep the actionMenus, it is relevant as it computes isM2MGrouped which crashes if we
        // don't correctly extract the fieldName/granularity from the groupBy
        actionMenus: {},
    });

    expect(".o_group_header").toHaveCount(2);
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(0);
    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(1);
    await click(target.querySelector(".o_data_row .o_list_record_selector"));
    expect(".o_control_panel_actions .o_list_selection_box").toHaveCount(1);
});

test("aggregates are computed correctly", async () => {
    // map: foo record id -> qux value
    const quxVals = { 1: 1.0, 2: 2.0, 3: 3.0, 4: 0 };

    serverData.models.foo.records = serverData.models.foo.records.map((r) => ({
        ...r,
        qux: quxVals[r.id],
    }));

    await mountView({
        type: "list",
        resModel: "foo",
        arch: /*xml*/ `
            <tree>
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
                <field name="qux" avg="Average"/>
            </tree>`,
        searchViewArch: `
            <search>
                <filter name="my_filter" string="My Filter" domain="[('id', '=', 0)]"/>
            </search>`,
    });
    const tbodySelectors = target.querySelectorAll("tbody .o_list_record_selector input");
    const theadSelector = target.querySelector("thead .o_list_record_selector input");

    const getFooterTextArray = () => {
        return [...target.querySelectorAll("tfoot td")].map((td) => td.innerText);
    };

    expect(getFooterTextArray()).toEqual(["", "", "32", "1.50"]);

    await click(tbodySelectors[0]);
    await click(tbodySelectors[3]);
    expect(getFooterTextArray()).toEqual(["", "", "6", "0.50"]);

    await click(theadSelector);
    expect(getFooterTextArray()).toEqual(["", "", "32", "1.50"]);

    // Let's update the view to dislay NO records
    await click(target.querySelector(".o_list_unselect_all"));
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "My Filter");
    expect(getFooterTextArray()).toEqual(["", "", "", ""]);
});

test("aggregates are computed correctly in grouped lists", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["m2o"],
        arch: '<tree editable="bottom"><field name="foo" /><field name="int_field" sum="Sum"/></tree>',
    });
    const groupHeaders = target.querySelectorAll(".o_group_header");
    expect(groupHeaders[0].querySelector("td:last-child").textContent).toBe("23", { message: "first group total should be 23" });
    expect(groupHeaders[1].querySelector("td:last-child").textContent).toBe("9", { message: "second group total should be 9" });
    expect(target.querySelector("tfoot td:last-child").textContent).toBe("32", { message: "total should be 32" });
    await click(groupHeaders[0]);
    await click(target.querySelector("tbody .o_list_record_selector input:first-child"));
    expect(target.querySelector("tfoot td:last-child").textContent).toBe("10", { message: "total should be 10 as first record of first group is selected" });
});

test("aggregates are formatted correctly in grouped lists", async () => {
    // in this scenario, there is a widget on an aggregated field, and this widget has no
    // associated formatter, so we fallback on the formatter corresponding to the field type
    fieldRegistry.add("my_float", FloatField);
    serverData.models.foo.records[0].qux = 5.1654846456;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="qux" widget="my_float" sum="Sum"/>
            </tree>`,
        groupBy: ["int_field"],
    });

    expect(getNodesTextContent(target.querySelectorAll(".o_group_header .o_list_number"))).toEqual(["9.00", "13.00", "5.17", "-3.00"]);
});

test("aggregates in grouped lists with buttons", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["m2o"],
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
                <button name="a" type="object"/>
                <field name="qux" sum="Sum"/>
            </tree>`,
    });

    const cellVals = ["23", "6.40", "9", "13.00", "32", "19.40"];
    expect(getNodesTextContent(target.querySelectorAll(".o_list_number"))).toEqual(cellVals);
});

test("date field aggregates in grouped lists", async () => {
    // this test simulates a scenario where a date field has a aggregator
    // and the web_read_group thus return a value for that field for each group
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["m2o"],
        arch: `
            <tree>
                <field name="foo"/>
                <field name="date"/>
            </tree>`,
        async mockRPC(route, args, performRPC) {
            if (args.method === "web_read_group") {
                const res = await performRPC(...arguments);
                res.groups[0].date = "2021-03-15";
                res.groups[1].date = "2021-02-11";
                return res;
            }
        },
    });

    expect(".o_group_header").toHaveCount(2);
    expect(getNodesTextContent(target.querySelectorAll(".o_group_header"))).toEqual([`Value 1 (3) `, `Value 2 (1) `]);
});

test("hide aggregated value in grouped lists when no data provided by RPC call", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="qux" widget="float_time" sum="Sum"/>
                </tree>`,
        mockRPC: async function (route, args, performRPC) {
            if (args.method === "web_read_group") {
                const result = await performRPC(route, args);
                result.groups.forEach((group) => {
                    delete group.qux;
                });
                return Promise.resolve(result);
            }
        },
    });

    expect(target.querySelectorAll("tfoot td")[2].textContent).toBe("", { message: "There isn't any aggregated value" });
});

test("aggregates are updated when a line is edited", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="int_field" sum="Sum"/></tree>',
    });

    expect(target.querySelector('span[data-tooltip="Sum"]').innerText).toBe("32", { message: "current total should be 32" });

    await click(target.querySelector("tr.o_data_row td.o_data_cell"));
    await contains("td.o_data_cell input").edit("15");

    expect(target.querySelector('span[data-tooltip="Sum"]').innerText).toBe("37", { message: "current total should be 37" });
});

test("aggregates are formatted according to field widget", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="qux" widget="float_time" sum="Sum"/>
            </tree>`,
    });

    expect(target.querySelectorAll("tfoot td")[2].textContent).toBe("19:24", { message: "total should be formatted as a float_time" });
});

test("aggregates digits can be set with digits field attribute", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" widget="monetary" sum="Sum" digits="[69,3]"/>
            </tree>`,
    });

    expect(target.querySelectorAll(".o_data_row td")[1].textContent).toBe("1200.00", { message: "field should still be formatted based on currency" });
    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("—", { message: "aggregates monetary should never work if no currency field is present" });
});

test("aggregates monetary (same currency)", async () => {
    serverData.models.foo.records[0].currency_id = 1;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" widget="monetary" sum="Sum"/>
                <field name="currency_id"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody .o_monetary_cell"))).toEqual(["$\u00a01200.00", "$\u00a0500.00", "$\u00a0300.00", "$\u00a00.00"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("$\u00a02000.00");
});

test("aggregates monetary (different currencies)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" widget="monetary" sum="Sum"/>
                <field name="currency_id"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody .o_monetary_cell"))).toEqual(["1200.00\u00a0€", "$\u00a0500.00", "$\u00a0300.00", "$\u00a00.00"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("—");
});

test("aggregates monetary (currency field not in view)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" widget="monetary" sum="Sum" options="{'currency_field': 'currency_test'}"/>
                <field name="currency_id"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody .o_monetary_cell"))).toEqual(["1200.00", "500.00", "300.00", "0.00"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("—");
});

test("aggregates monetary (currency field in view)", async () => {
    serverData.models.foo.fields.amount.currency_field = "currency_test";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" widget="monetary" sum="Sum"/>
                <field name="currency_test"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody .o_monetary_cell"))).toEqual(["$\u00a01200.00", "$\u00a0500.00", "$\u00a0300.00", "$\u00a00.00"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("$\u00a02000.00");
});

test("aggregates monetary with custom digits (same currency)", async () => {
    serverData.models.foo.records = serverData.models.foo.records.map((record) => ({
        ...record,
        currency_id: 1,
    }));
    patchWithCleanup(currencies, {
        1: { ...currencies[1], digits: [42, 4] },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="amount" sum="Sum"/>
                <field name="currency_id"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody [name='amount']"))).toEqual(["$\u00a01200.0000", "$\u00a0500.0000", "$\u00a0300.0000", "$\u00a00.0000"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("$\u00a02000.0000");
});

test("aggregates float with monetary widget and custom digits (same currency)", async () => {
    serverData.models.foo.records = serverData.models.foo.records.map((record) => ({
        ...record,
        currency_id: 1,
    }));
    patchWithCleanup(currencies, {
        1: { ...currencies[1], digits: [42, 4] },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="qux" widget="monetary" sum="Sum"/>
                <field name="currency_id"/>
            </tree>`,
    });

    expect(getNodesTextContent(target.querySelectorAll("tbody .o_monetary_cell"))).toEqual(["$\u00a00.4000", "$\u00a013.0000", "$\u00a0-3.0000", "$\u00a09.0000"]);

    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("$\u00a019.4000");
});

test("currency_field is taken into account when formatting monetary values", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="company_currency_id" column_invisible="1"/>
                <field name="currency_id" column_invisible="1"/>
                <field name="amount"/>
                <field name="amount_currency"/>
            </tree>`,
    });

    expect(target.querySelectorAll('.o_data_row td[name="amount"]')[0].textContent).toBe("1200.00\u00a0€", { message: "field should be formatted based on currency_id" });
    expect(target.querySelectorAll('.o_data_row td[name="amount_currency"]')[0].textContent).toBe("$\u00a01100.00", { message: "field should be formatted based on company_currency_id" });
    expect(target.querySelectorAll("tfoot td")[1].textContent).toBe("—", { message: "aggregates monetary should never work if different currencies are used" });
});

test("groups can not be sorted on a different field than the first field of the groupBy - 1", async () => {
    assert.expect(1);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree default_order="foo"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                expect(args.kwargs.orderby).toBe("", { message: "should not have an orderBy" });
            }
        },
        groupBy: ["bar"],
    });
});

test("groups can not be sorted on a different field than the first field of the groupBy - 2", async () => {
    assert.expect(1);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree default_order="foo"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                expect(args.kwargs.orderby).toBe("", { message: "should not have an orderBy" });
            }
        },
        groupBy: ["bar", "foo"],
    });
});

test("groups can be sorted on the first field of the groupBy", async () => {
    assert.expect(3);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree default_order="bar desc"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                expect(args.kwargs.orderby).toBe("bar DESC", { message: "should have an orderBy" });
            }
        },
        groupBy: ["bar"],
    });

    expect(document.querySelector(".o_group_header:first-child").textContent.trim()).toBe("Yes (3)");
    expect(document.querySelector(".o_group_header:last-child").textContent.trim()).toBe("No (1)");
});

test("groups can't be sorted on aggregates if there is no record", async () => {
    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["foo"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                assert.step(args.kwargs.orderby || "default order");
            }
        },
    });

    await contains(".o_column_sortable").click();
    expect(["default order"]).toVerifySteps();
});

test("groups can be sorted on aggregates", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["foo"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                assert.step(args.kwargs.orderby || "default order");
            }
        },
    });

    expect($(target).find("tbody .o_list_number").text()).toBe("51710", { message: "initial order should be 5, 17, 17" });
    expect($(target).find("tfoot td:last()").text()).toBe("32", { message: "total should be 32" });

    await contains(".o_column_sortable").click();
    expect($(target).find("tfoot td:last()").text()).toBe("32", { message: "total should still be 32" });
    expect($(target).find("tbody .o_list_number").text()).toBe("51017", { message: "order should be 5, 10, 17" });

    await contains(".o_column_sortable").click();
    expect($(target).find("tbody .o_list_number").text()).toBe("17105", { message: "initial order should be 17, 10, 5" });
    expect($(target).find("tfoot td:last()").text()).toBe("32", { message: "total should still be 32" });

    expect(["default order", "int_field ASC", "int_field DESC"]).toVerifySteps();
});

test("groups cannot be sorted on non-aggregable fields if every group is folded", async () => {
    serverData.models.foo.fields.sort_field = {
        string: "sortable_field",
        type: "sting",
        sortable: true,
        default: "value",
    };
    serverData.models.foo.records.forEach((elem) => {
        elem.sort_field = "value" + elem.id;
    });
    serverData.models.foo.fields.foo.sortable = true;
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["foo"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field"/>
                <field name="sort_field"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                assert.step(args.kwargs.orderby || "default order");
            }
        },
    });
    expect(["default order"]).toVerifySteps();

    // we cannot sort by sort_field since it doesn't have a aggregator
    await click(target.querySelector(".o_column_sortable[data-name='sort_field']"));
    expect([]).toVerifySteps();

    // we can sort by int_field since it has a aggregator
    await click(target.querySelector(".o_column_sortable[data-name='int_field']"));
    expect(["int_field ASC"]).toVerifySteps();

    // we keep previous order
    await click(target.querySelector(".o_column_sortable[data-name='sort_field']"));
    expect([]).toVerifySteps();

    // we can sort on foo since we are groupped by foo + previous order
    await click(target.querySelector(".o_column_sortable[data-name='foo']"));
    expect(["foo ASC, int_field ASC"]).toVerifySteps();
});

test("groups can be sorted on non-aggregable fields if a group isn't folded", async () => {
    serverData.models.foo.fields.foo.sortable = true;
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
            </tree>`,
        mockRPC(route, args) {
            const { method } = args;
            if (method === "web_read_group") {
                assert.step(`web_read_group.orderby: ${args.kwargs.orderby || "default order"}`);
            }
            if (method === "web_search_read") {
                assert.step(`web_search_read.order: ${args.kwargs.order || "default order"}`);
            }
        },
    });
    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell[name='foo']"))).toEqual(["yop", "blip", "gnap"]);
    assert.verifySteps(["web_read_group.orderby: default order", "web_search_read.order: default order"]);

    await click(target.querySelector(".o_column_sortable[data-name='foo']"));
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell[name='foo']"))).toEqual(["blip", "gnap", "yop"]);
    assert.verifySteps(["web_read_group.orderby: default order", "web_search_read.order: foo ASC"]);
});

test("groups can be sorted on non-aggregable fields if a group isn't folded with expand='1'", async () => {
    serverData.models.foo.fields.foo.sortable = true;
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
            <tree editable="bottom" expand="1">
                <field name="foo"/>
            </tree>`,
        mockRPC(route, args) {
            const { method } = args;
            if (method === "web_read_group") {
                assert.step(`web_read_group.orderby: ${args.kwargs.orderby || "default order"}`);
            }
            if (method === "web_search_read") {
                assert.step(`web_search_read.orderby: ${args.kwargs.order || "default order"}`);
            }
        },
    });
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell[name='foo']"))).toEqual(["blip", "yop", "blip", "gnap"]);
    assert.verifySteps(["web_read_group.orderby: default order", "web_search_read.orderby: default order", "web_search_read.orderby: default order"]);

    await click(target.querySelector(".o_column_sortable[data-name='foo']"));
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell[name='foo']"))).toEqual(["blip", "blip", "gnap", "yop"]);
    assert.verifySteps(["web_read_group.orderby: default order", "web_search_read.orderby: foo ASC", "web_search_read.orderby: foo ASC"]);
});

test("properly apply onchange in simple case", async () => {
    serverData.models.foo.onchanges = {
        foo: function (obj) {
            obj.int_field = obj.foo.length + 1000;
        },
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="int_field"/></tree>',
    });

    await click(target.querySelector(".o_field_cell"));

    expect(target.querySelector(".o_field_widget[name=int_field] input").value).toBe("10", { message: "should contain initial value" });

    await contains(".o_field_widget[name=foo] input").edit("tralala");

    expect(target.querySelector(".o_field_widget[name=int_field] input").value).toBe("1007", { message: "should contain input with onchange applied" });
});

test("column width should not change when switching mode", async () => {
    // Warning: this test is css dependant
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="int_field" readonly="1"/>
                <field name="m2o"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
    });

    var startWidths = [...target.querySelectorAll("thead th")].map((el) => el.offsetWidth);
    var startWidth = window.getComputedStyle(target.querySelector("table")).width;

    // start edition of first row
    await click(target.querySelector("td:not(.o_list_record_selector)"));

    var editionWidths = [...target.querySelectorAll("thead th")].map((el) => el.offsetWidth);
    var editionWidth = window.getComputedStyle(target.querySelector("table")).width;

    // leave edition
    await click($(".o_list_button_save:visible").get(0));

    var readonlyWidths = [...target.querySelectorAll("thead th")].map((el) => el.offsetWidth);
    var readonlyWidth = window.getComputedStyle(target.querySelector("table")).width;

    expect(editionWidth).toBe(startWidth, { message: "table should have kept the same width when switching from readonly to edit mode" });
    expect(editionWidths).toEqual(startWidths, { message: "width of columns should remain unchanged when switching from readonly to edit mode" });
    expect(readonlyWidth).toBe(editionWidth, { message: "table should have kept the same width when switching from edit to readonly mode" });
    expect(readonlyWidths).toEqual(editionWidths, { message: "width of columns should remain unchanged when switching from edit to readonly mode" });
});

test("column widths should depend on the content when there is data", async () => {
    serverData.models.foo.records[0].foo = "Some very very long value for a char field";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="bar"/>
                    <field name="foo"/>
                    <field name="int_field"/>
                    <field name="qux"/>
                    <field name="date"/>
                    <field name="datetime"/>
                </tree>`,
        limit: 2,
    });

    expect(target.querySelector("thead .o_list_record_selector").offsetWidth).toBe(41);
    const widthPage1 = target.querySelector(`th[data-name=foo]`).offsetWidth;

    await pagerNext(target);

    expect(target.querySelector("thead .o_list_record_selector").offsetWidth).toBe(41);
    const widthPage2 = target.querySelector(`th[data-name=foo]`).offsetWidth;
    assert.ok(widthPage1 > widthPage2, "column widths should be computed dynamically according to the content");
});

test("width of some of the fields should be hardcoded if no data", async () => {
    const assertions = [
        { field: "bar", expected: 70, type: "Boolean" },
        { field: "int_field", expected: 74, type: "Integer" },
        { field: "qux", expected: 92, type: "Float" },
        { field: "date", expected: 92, type: "Date" },
        { field: "datetime", expected: 146, type: "Datetime" },
        { field: "amount", expected: 104, type: "Monetary" },
    ];
    assert.expect(9);

    serverData.models.foo.records = [];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="bar"/>
                    <field name="foo"/>
                    <field name="int_field"/>
                    <field name="qux"/>
                    <field name="date"/>
                    <field name="datetime"/>
                    <field name="amount"/>
                    <field name="currency_id" width="25px"/>
                </tree>`,
    });

    expect(".o_resize").toHaveCount(8);
    assertions.forEach((a) => {
        expect(target.querySelector(`th[data-name="${a.field}"]`).offsetWidth).toBe(a.expected, `Field ${a.type} should have a fixed width of ${a.expected} pixels`);
    });
    expect(target.querySelector('th[data-name="foo"]').style.width).toBe("100%", { message: "Char field should occupy the remaining space" });
    expect(target.querySelector('th[data-name="currency_id"]').offsetWidth).toBe(25, { message: "Currency field should have a fixed width of 25px (see arch)" });
});

test("colspan of empty lines is correct in readonly", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form edit="0">
                    <sheet>
                        <field name="foo_o2m">
                            <tree editable="bottom">
                                <field name="int_field"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
    });
    // in readonly mode, the delete action is not available
    expect(target.querySelector("tbody td").getAttribute("colspan")).toBe("1");
});

test("colspan of empty lines is correct in edit", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <sheet>
                        <field name="foo_o2m">
                            <tree editable="bottom">
                                <field name="int_field"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
    });
    // in edit mode, the delete action is available and the empty lines should cover that col
    expect(target.querySelector("tbody td").getAttribute("colspan")).toBe("2");
});

test("colspan of empty lines is correct in readonly with optional fields", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form edit="0">
                    <sheet>
                        <field name="foo_o2m">
                            <tree editable="bottom">
                                <field name="int_field"/>
                                <field name="foo" optional="hidden"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
    });
    // in readonly mode, the delete action is not available but the optional fields is and the empty lines should cover that col
    expect(target.querySelector("tbody td").getAttribute("colspan")).toBe("2");
});

test("colspan of empty lines is correct in edit with optional fields", async () => {
    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <sheet>
                        <field name="foo_o2m">
                            <tree editable="bottom">
                                <field name="int_field"/>
                                <field name="foo" optional="hidden"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
    });
    // in edit mode, both the delete action and the optional fields are available and the empty lines should cover that col
    expect(target.querySelector("tbody td").getAttribute("colspan")).toBe("2");
});

test("width of some fields should be hardcoded if no data, and list initially invisible", async () => {
    const assertions = [
        { field: "bar", expected: 70, type: "Boolean" },
        { field: "int_field", expected: 74, type: "Integer" },
        { field: "qux", expected: 92, type: "Float" },
        { field: "date", expected: 92, type: "Date" },
        { field: "datetime", expected: 146, type: "Datetime" },
        { field: "amount", expected: 104, type: "Monetary" },
    ];
    assert.expect(12);

    serverData.models.foo.fields.foo_o2m = {
        string: "Foo O2M",
        type: "one2many",
        relation: "foo",
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        mode: "edit",
        arch: `
                <form>
                    <sheet>
                        <notebook>
                            <page string="Page1"></page>
                            <page string="Page2">
                                <field name="foo_o2m">
                                    <tree editable="bottom">
                                        <field name="bar"/>
                                        <field name="foo"/>
                                        <field name="int_field"/>
                                        <field name="qux"/>
                                        <field name="date"/>
                                        <field name="datetime"/>
                                        <field name="amount"/>
                                        <field name="currency_id" width="25px"/>
                                    </tree>
                                </field>
                            </page>
                        </notebook>
                    </sheet>
                </form>`,
    });

    expect(".o_field_one2many").toHaveCount(0);

    await click(target.querySelector(".nav-item:last-child .nav-link"));

    expect(".o_field_one2many").toBeVisible();

    expect(".o_field_one2many .o_resize").toHaveCount(8);
    assertions.forEach((a) => {
        expect(target.querySelector(`.o_field_one2many th[data-name="${a.field}"]`).style.width).toBe(`${a.expected}px`, `Field ${a.type} should have a fixed width of ${a.expected} pixels`);
    });
    expect(target.querySelector('.o_field_one2many th[data-name="foo"]').style.width).toBe("100%", { message: "Char field should occupy the remaining space" });
    expect(target.querySelector('th[data-name="currency_id"]').offsetWidth).toBe(25, { message: "Currency field should have a fixed width of 25px (see arch)" });
    expect(target.querySelector(".o_list_actions_header").offsetWidth).toBe(32);
});

test("empty editable list with the handle widget and no content help", async () => {
    // no records for the foo model
    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="int_field" widget="handle" />
                    <field name="foo" />
                </tree>`,
        noContentHelp: '<p class="hello">click to add a foo</p>',
    });

    expect(".o_view_nocontent").toHaveCount(1, { message: "should have no content help" });

    // click on create button
    await click($(".o_list_button_add:visible").get(0));
    const handleWidgetWidth = "33px";
    const handleWidgetHeader = target.querySelector("thead > tr > th.o_handle_cell");

    expect(window.getComputedStyle(handleWidgetHeader).width).toBe(handleWidgetWidth, { message: "While creating first record, width should be applied to handle widget." });

    // creating one record
    await contains(".o_selected_row [name='foo'] input").edit("test_foo");
    await clickSave(target);
    expect(window.getComputedStyle(handleWidgetHeader).width).toBe(handleWidgetWidth, { message: "After creation of the first record, width of the handle widget should remain as it is" });
});

test("editable list: overflowing table", async () => {
    serverData.models.bar = {
        fields: {
            titi: { string: "Small char", type: "char", sortable: true },
            grosminet: { string: "Beeg char", type: "char", sortable: true },
        },
        records: [
            {
                id: 1,
                titi: "Tiny text",
                grosminet:
                    // Just want to make sure that the table is overflowed
                    `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Donec est massa, gravida eget dapibus ac, eleifend eget libero.
                    Suspendisse feugiat sed massa eleifend vestibulum. Sed tincidunt
                    velit sed lacinia lacinia. Nunc in fermentum nunc. Vestibulum ante
                    ipsum primis in faucibus orci luctus et ultrices posuere cubilia
                    Curae; Nullam ut nisi a est ornare molestie non vulputate orci.
                    Nunc pharetra porta semper. Mauris dictum eu nulla a pulvinar. Duis
                    eleifend odio id ligula congue sollicitudin. Curabitur quis aliquet
                    nunc, ut aliquet enim. Suspendisse malesuada felis non metus
                    efficitur aliquet.`,
            },
        ],
    };
    await mountView({
        type: "list",
        resModel: "bar",
        arch: `
            <tree editable="top">
                <field name="titi"/>
                <field name="grosminet" widget="char"/>
            </tree>`,
    });

    expect(target.querySelector("table").offsetWidth).toBe(target.querySelector(".o_list_renderer").offsetWidth, { message: "Table should not be stretched by its content" });
});

test("editable list: overflowing table (3 columns)", async () => {
    const longText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Donec est massa, gravida eget dapibus ac, eleifend eget libero.
                    Suspendisse feugiat sed massa eleifend vestibulum. Sed tincidunt
                    velit sed lacinia lacinia. Nunc in fermentum nunc. Vestibulum ante
                    ipsum primis in faucibus orci luctus et ultrices posuere cubilia
                    Curae; Nullam ut nisi a est ornare molestie non vulputate orci.
                    Nunc pharetra porta semper. Mauris dictum eu nulla a pulvinar. Duis
                    eleifend odio id ligula congue sollicitudin. Curabitur quis aliquet
                    nunc, ut aliquet enim. Suspendisse malesuada felis non metus
                    efficitur aliquet.`;

    serverData.models.bar = {
        fields: {
            titi: { string: "Small char", type: "char", sortable: true },
            grosminet1: { string: "Beeg char 1", type: "char", sortable: true },
            grosminet2: { string: "Beeg char 2", type: "char", sortable: true },
            grosminet3: { string: "Beeg char 3", type: "char", sortable: true },
        },
        records: [
            {
                id: 1,
                titi: "Tiny text",
                grosminet1: longText,
                grosminet2: longText + longText,
                grosminet3: longText + longText + longText,
            },
        ],
    };
    await mountView({
        arch: `
            <tree editable="top">
                <field name="titi"/>
                <field name="grosminet1" class="large"/>
                <field name="grosminet3" class="large"/>
                <field name="grosminet2" class="large"/>
            </tree>`,
        resModel: "bar",
        type: "list",
    });

    expect(target.querySelector("table").offsetWidth).toBe(target.querySelector(".o_list_view").offsetWidth);
    const largeCells = target.querySelectorAll(".o_data_cell.large");
    assert.ok(Math.abs(largeCells[0].offsetWidth - largeCells[1].offsetWidth) <= 1);
    assert.ok(Math.abs(largeCells[1].offsetWidth - largeCells[2].offsetWidth) <= 1);
    assert.ok(target.querySelector(".o_data_cell:not(.large)").offsetWidth < largeCells[0].offsetWidth);
});

test("editable list: list view in an initially unselected notebook page", async () => {
    serverData.models.foo.records = [{ id: 1, o2m: [1] }];
    serverData.models.bar = {
        fields: {
            titi: { string: "Small char", type: "char", sortable: true },
            grosminet: { string: "Beeg char", type: "char", sortable: true },
        },
        records: [
            {
                id: 1,
                titi: "Tiny text",
                grosminet: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + "Ut at nisi congue, facilisis neque nec, pulvinar nunc. " + "Vivamus ac lectus velit.",
            },
        ],
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
                <form>
                    <sheet>
                        <notebook>
                            <page string="Page1"></page>
                            <page string="Page2">
                                <field name="o2m">
                                    <tree editable="bottom">
                                        <field name="titi"/>
                                        <field name="grosminet"/>
                                    </tree>
                                </field>
                            </page>
                        </notebook>
                    </sheet>
                </form>`,
    });
    expect(".o_field_one2many").toHaveCount(0);

    await click(target.querySelector(".nav-item:last-child .nav-link"));
    expect(".o_field_one2many").toHaveCount(1);

    const [titi, grosminet] = target.querySelectorAll(".tab-pane:last-child th");
    assert.ok(titi.style.width.split("px")[0] > 80 && grosminet.style.width.split("px")[0] > 500, "list has been correctly frozen after being visible");
});

test("editable list: list view hidden by an invisible modifier", async () => {
    serverData.models.foo.records = [{ id: 1, bar: true, o2m: [1] }];
    serverData.models.bar = {
        fields: {
            titi: { string: "Small char", type: "char", sortable: true },
            grosminet: { string: "Beeg char", type: "char", sortable: true },
        },
        records: [
            {
                id: 1,
                titi: "Tiny text",
                grosminet: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + "Ut at nisi congue, facilisis neque nec, pulvinar nunc. " + "Vivamus ac lectus velit.",
            },
        ],
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
            <form>
                <sheet>
                    <field name="bar"/>
                    <field name="o2m" invisible="bar">
                        <tree editable="bottom">
                            <field name="titi"/>
                            <field name="grosminet"/>
                        </tree>
                    </field>
                </sheet>
            </form>`,
    });
    expect(".o_field_one2many").toHaveCount(0);

    await click(target.querySelector(".o_field_boolean input"));
    expect(".o_field_one2many").toHaveCount(1);

    const [titi, grosminet] = target.querySelectorAll("th");
    assert.ok(titi.style.width.split("px")[0] > 80 && grosminet.style.width.split("px")[0] > 700, "list has been correctly frozen after being visible");
});

test("editable list: updating list state while invisible", async () => {
    serverData.models.foo.onchanges = {
        bar: function (obj) {
            obj.o2m = [[5], [0, null, { display_name: "Whatever" }]];
        },
    };
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        arch: `
            <form>
                <sheet>
                    <field name="bar"/>
                    <notebook>
                        <page string="Page 1"></page>
                        <page string="Page 2">
                            <field name="o2m">
                                <tree editable="bottom">
                                    <field name="display_name"/>
                                </tree>
                            </field>
                        </page>
                    </notebook>
                </sheet>
            </form>`,
    });
    expect(".o_field_one2many").toHaveCount(0);

    await click(target.querySelector(".o_field_boolean input"));
    expect(".o_field_one2many").toHaveCount(0);

    await click(target.querySelector(".nav-item:last-child .nav-link"));
    expect(".o_field_one2many").toHaveCount(1);
    expect(target.querySelector(".o_field_one2many .o_data_row").textContent).toBe("Whatever");
    assert.notEqual(target.querySelector("th").style.width, "", "Column header should have been frozen");
});

test("empty list: state with nameless and stringless buttons", async () => {
    serverData.models.foo.records = [];
    await mountView({
        type: "list",
        arch: `
            <tree>
                <field name="foo"/>
                <button string="choucroute"/>
                <button icon="fa-heart"/>
            </tree>`,
        resModel: "foo",
    });

    expect([...target.querySelectorAll("th")].find((el) => el.textContent === "Foo").style.width).toBe("50%", { message: "Field column should be frozen" });
    expect(target.querySelector("th:last-child").style.width).toBe("50%", { message: "Buttons column should be frozen" });
});

test("editable list: unnamed columns cannot be resized", async () => {
    serverData.models.foo.records = [{ id: 1, o2m: [1] }];
    serverData.models.bar.records = [{ id: 1, display_name: "Oui" }];
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        mode: "edit",
        arch: `
            <form>
                <sheet>
                    <field name="o2m">
                        <tree editable="top">
                            <field name="display_name"/>
                            <button name="the_button" icon="fa-heart"/>
                        </tree>
                    </field>
                </sheet>
            </form>`,
    });

    const [charTh, buttonTh] = target.querySelectorAll(".o_field_one2many th");
    const thRect = charTh.getBoundingClientRect();
    const resizeRect = charTh.querySelector(".o_resize").getBoundingClientRect();

    assert.ok(resizeRect.right - thRect.right <= 1, "First resize handle should be attached at the end of the first header");
    assert.containsNone(buttonTh, ".o_resize", "Columns without name should not have a resize handle");
});

test("editable list view, click on m2o dropdown does not close editable row", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="m2o"/></tree>',
    });

    await click($(".o_list_button_add:visible").get(0));
    expect(target.querySelector(".o_selected_row .o_field_many2one input").value).toBe("");
    await click(target.querySelector(".o_selected_row .o_field_many2one input"));
    expect(".o_field_many2one .o-autocomplete--dropdown-menu").toHaveCount(1);

    await click(target.querySelector(".o_field_many2one .o-autocomplete--dropdown-menu .dropdown-item"));
    expect(target.querySelector(".o_selected_row .o_field_many2one input").value).toBe("Value 1");
    expect(".o_selected_row").toHaveCount(1, { message: "should still have editable row" });
});

test("width of some of the fields should be hardcoded if no data (grouped case)", async () => {
    const assertions = [
        { field: "bar", expected: 70, type: "Boolean" },
        { field: "int_field", expected: 74, type: "Integer" },
        { field: "qux", expected: 92, type: "Float" },
        { field: "date", expected: 92, type: "Date" },
        { field: "datetime", expected: 146, type: "Datetime" },
        { field: "amount", expected: 104, type: "Monetary" },
    ];
    assert.expect(9);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="bar"/>
                    <field name="foo"/>
                    <field name="int_field"/>
                    <field name="qux"/>
                    <field name="date"/>
                    <field name="datetime"/>
                    <field name="amount"/>
                    <field name="currency_id" width="25px"/>
                </tree>`,
        groupBy: ["int_field"],
    });

    expect(".o_resize").toHaveCount(8);
    assertions.forEach((a) => {
        expect(a.expected).toBe(target.querySelectorAll(`th[data-name="${a.field}"]`)[0].offsetWidth, `Field ${a.type} should have a fixed width of ${a.expected} pixels`);
    });
    expect(target.querySelectorAll('th[data-name="foo"]')[0].style.width).toBe("100%", { message: "Char field should occupy the remaining space" });
    expect(target.querySelectorAll('th[data-name="currency_id"]')[0].offsetWidth).toBe(25, { message: "Currency field should have a fixed width of 25px (see arch)" });
});

test("column width should depend on the widget", async () => {
    serverData.models.foo.records = []; // the width heuristic only applies when there are no records
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="datetime" widget="date"/>
                <field name="text"/>
            </tree>`,
    });
    expect(target.querySelector('th[data-name="datetime"]').offsetWidth).toBe(92, { message: "should be the optimal width to display a date, not a datetime" });
});

test("column widths are kept when adding first record", async () => {
    serverData.models.foo.records = []; // in this scenario, we start with no records
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="datetime"/>
                <field name="text"/>
            </tree>`,
    });

    var width = target.querySelectorAll('th[data-name="datetime"]')[0].offsetWidth;

    await click($(".o_list_button_add:visible").get(0));

    expect(".o_data_row").toHaveCount(1);
    expect(target.querySelectorAll('th[data-name="datetime"]')[0].offsetWidth).toBe(width);
});

test("column widths are kept when editing a record", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="datetime"/>
                <field name="text"/>
            </tree>`,
    });

    var width = target.querySelectorAll('th[data-name="datetime"]')[0].offsetWidth;

    await click(target.querySelector(".o_data_row:nth-child(1) > .o_data_cell:nth-child(2)"));
    expect(".o_selected_row").toHaveCount(1);

    var longVal = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed blandit, " + "justo nec tincidunt feugiat, mi justo suscipit libero, sit amet tempus ipsum purus " + "bibendum est.";
    await editInput(target.querySelector(".o_field_widget[name=text] .o_input"), null, longVal);
    await clickSave(target);

    expect(".o_selected_row").toHaveCount(0);
    expect(target.querySelectorAll('th[data-name="datetime"]')[0].offsetWidth).toBe(width);
});

test("column widths are kept when switching records in edition", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="text"/>
            </tree>`,
    });

    const width = target.querySelectorAll('th[data-name="m2o"]')[0].offsetWidth;

    await click(target.querySelector(".o_data_row:nth-child(1) > .o_data_cell:nth-child(2)"));

    expect(".o_data_row:nth-child(1)").toHaveClass("o_selected_row");
    expect(target.querySelectorAll('th[data-name="m2o"]')[0].offsetWidth).toBe(width);

    await click(target.querySelector(".o_data_row:nth-child(2) > .o_data_cell:nth-child(2)"));

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(target.querySelectorAll('th[data-name="m2o"]')[0].offsetWidth).toBe(width);
});

test("column widths are re-computed on window resize", async () => {
    serverData.models.foo.records[0].text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + "Sed blandit, justo nec tincidunt feugiat, mi justo suscipit libero, sit amet tempus " + "ipsum purus bibendum est.";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="datetime"/>
                <field name="text"/>
            </tree>`,
    });

    const initialTextWidth = target.querySelectorAll('th[data-name="text"]')[0].offsetWidth;
    const selectorWidth = queryFirst("th.o_list_record_selector").offsetWidth;

    // simulate a window resize
    target.style.width = target.getBoundingClientRect().width / 2 + "px";
    window.dispatchEvent(new Event("resize"));

    const postResizeTextWidth = target.querySelectorAll('th[data-name="text"]')[0].offsetWidth;
    const postResizeSelectorWidth = queryFirst("th.o_list_record_selector").offsetWidth;
    assert.ok(postResizeTextWidth < initialTextWidth);
    expect(selectorWidth).toBe(postResizeSelectorWidth);
});

test("columns with an absolute width are never narrower than that width", async () => {
    serverData.models.foo.records[0].text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, " + "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim " + "veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo " + "consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " + "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, " + "sunt in culpa qui officia deserunt mollit anim id est laborum";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="datetime"/>
                    <field name="int_field" width="200px"/>
                    <field name="text"/>
                </tree>`,
    });
    const pixelsWidth = getComputedStyle(target.querySelector('th[data-name="int_field"]')).width;
    const width = Math.floor(parseFloat(pixelsWidth));
    expect(width).toBe(200);
});

test("list view with data: text columns are not crushed", async () => {
    const longText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do " + "eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim " + "veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo " + "consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " + "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, " + "sunt in culpa qui officia deserunt mollit anim id est laborum";
    serverData.models.foo.records[0].foo = longText;
    serverData.models.foo.records[0].text = longText;
    serverData.models.foo.records[1].foo = "short text";
    serverData.models.foo.records[1].text = "short text";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="text"/></tree>',
    });

    const foo = [...target.querySelectorAll("th")].find((el) => el.textContent === "Foo");
    const fooWidth = Math.ceil(foo.getBoundingClientRect().width);

    const text = [...target.querySelectorAll("th")].find((el) => el.textContent === "text field");
    const textWidth = Math.ceil(text.getBoundingClientRect().width);

    assert.ok(Math.abs(fooWidth - textWidth) <= 1, "both columns should have been given the same width");

    const firstRowHeight = $(target).find(".o_data_row:nth(0)")[0].offsetHeight;
    const secondRowHeight = $(target).find(".o_data_row:nth(1)")[0].offsetHeight;
    assert.ok(firstRowHeight > secondRowHeight, "in the first row, the (long) text field should be properly displayed on several lines");
});

test("button in a list view with a default relative width", async () => {
    await mountView({
        type: "list",
        arch: `
            <tree>
                <field name="foo"/>
                <button name="the_button" icon="fa-heart" width="0.1"/>
            </tree>`,
        resModel: "foo",
    });

    expect(target.querySelector(".o_data_cell button").style.width).toBe("", { message: "width attribute should not change the CSS style" });
});

test("button columns in a list view don't have a max width", async () => {
    // set a long foo value s.t. the column can be squeezed
    serverData.models.foo.records[0].foo = "Lorem ipsum dolor sit amet";
    await mountView({
        type: "list",
        arch: `
            <tree>
                <field name="foo"/>
                <button name="b1" string="Do This"/>
                <button name="b2" string="Do That"/>
                <button name="b3" string="Or Rather Do Something Else"/>
            </tree>`,
        resModel: "foo",
    });

    // simulate a window resize (buttons column width should not be squeezed)
    target.style.width = "300px";
    window.dispatchEvent(new Event("resize"));
    await nextTick();

    expect(window.getComputedStyle(target.querySelectorAll("th")[1]).maxWidth).toBe("92px", { message: "max-width should be set on column foo to the minimum column width (92px)" });
    expect(window.getComputedStyle(target.querySelectorAll("th")[2]).maxWidth).toBe("none", { message: "no max-width should be harcoded on the buttons column" });
});

test("column widths are kept when editing multiple records", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="datetime"/>
                <field name="text"/>
            </tree>`,
    });

    var width = target.querySelector('th[data-name="datetime"]').offsetWidth;

    // select two records and edit
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(rows[0].querySelectorAll(".o_data_cell")[1]);

    expect(".o_selected_row").toHaveCount(1);
    var longVal = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed blandit, " + "justo nec tincidunt feugiat, mi justo suscipit libero, sit amet tempus ipsum purus " + "bibendum est.";
    await editInput(target, ".o_field_widget[name=text] textarea", longVal);
    expect(".modal").toHaveCount(1);
    await contains(".modal .btn-primary").click();

    expect(".o_selected_row").toHaveCount(0);
    expect(target.querySelector('th[data-name="datetime"]').offsetWidth).toBe(width);
});

test("row height and width should not change when switching mode", async () => {
    // Warning: this test is css dependant
    serviceRegistry.add("localization", makeFakeLocalizationService({ multiLang: true }), {
        force: true,
    });

    serverData.models.foo.fields.foo.translate = true;
    serverData.models.foo.fields.boolean = { type: "boolean", string: "Bool" };
    const currencies = {};
    serverData.models.res_currency.records.forEach((currency) => {
        currencies[currency.id] = currency;
    });
    patchWithCleanup(session, { currencies });

    // the width is hardcoded to make sure we have the same condition
    // between debug mode and non debug mode
    target.style.width = "1200px";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo" required="1"/>
                    <field name="int_field" readonly="1"/>
                    <field name="boolean"/>
                    <field name="date"/>
                    <field name="text"/>
                    <field name="amount"/>
                    <field name="currency_id" column_invisible="1"/>
                    <field name="m2o"/>
                    <field name="m2m" widget="many2many_tags"/>
                </tree>`,
    });
    const startHeight = target.querySelector(".o_data_row").offsetHeight;
    const startWidth = target.querySelector(".o_data_row").offsetWidth;

    // start edition of first row
    await click(target.querySelector(".o_data_row > td:not(.o_list_record_selector)"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    const editionHeight = target.querySelector(".o_data_row").offsetHeight;
    const editionWidth = target.querySelector(".o_data_row").offsetWidth;

    // leave edition
    await click($(".o_list_button_save:visible").get(0));
    const readonlyHeight = target.querySelector(".o_data_row").offsetHeight;
    const readonlyWidth = target.querySelector(".o_data_row").offsetWidth;

    expect(startHeight).toBe(editionHeight);
    expect(startHeight).toBe(readonlyHeight);
    expect(startWidth).toBe(editionWidth);
    expect(startWidth).toBe(readonlyWidth);
});

test("fields are translatable in list view", async () => {
    serverData.models.foo.fields.foo.translate = true;
    serviceRegistry.add("localization", makeFakeLocalizationService({ multiLang: true }), {
        force: true,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        mockRPC(route, args) {
            if (route === "/web/dataset/call_kw/res.lang/get_installed") {
                return Promise.resolve([
                    ["en_US", "English"],
                    ["fr_BE", "Frenglish"],
                ]);
            }
            if (route === "/web/dataset/call_kw/foo/get_field_translations") {
                return Promise.resolve([
                    [
                        { lang: "en_US", source: "yop", value: "yop" },
                        { lang: "fr_BE", source: "yop", value: "valeur français" },
                    ],
                    { translation_type: "char", translation_show_source: false },
                ]);
            }
        },
        arch: '<tree editable="top">' + '<field name="foo" required="1"/>' + "</tree>",
    });
    await click(target.querySelector(".o_data_row .o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");

    await click(target.querySelector("span.o_field_translate"));
    expect(".o_translation_dialog").toHaveCount(1);
    expect(".o_translation_dialog .translation>input.o_field_char").toHaveCount(2, { message: "modal should have 2 languages to translate" })
});

test("long words in text cells should break into smaller lines", async () => {
    serverData.models.foo.records[0].text = "a";
    serverData.models.foo.records[1].text = "pneumonoultramicroscopicsilicovolcanoconiosis"; // longest english word I could find

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="text"/></tree>',
    });

    // Intentionally set the table width to a small size
    $(target).find("table").width("100px");
    $(target).find("th:last").width("100px");
    var shortText = $(target).find(".o_data_row:eq(0) td:last")[0].clientHeight;
    var longText = $(target).find(".o_data_row:eq(1) td:last")[0].clientHeight;
    var emptyText = $(target).find(".o_data_row:eq(2) td:last")[0].clientHeight;

    expect(shortText).toBe(emptyText, { message: "Short word should not change the height of the cell" });
    assert.ok(longText > emptyText, "Long word should change the height of the cell");
});

test("deleting one record and verify context key", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (args.method === "unlink") {
                assert.step("unlink");
                const { context } = args.kwargs;
                expect(context.ctx_key).toBe("ctx_val");
            }
        },
        context: {
            ctx_key: "ctx_val",
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "should have 4 records" });

    await click(target.querySelector("tbody td.o_list_record_selector:first-child input"));

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    expect("body").toHaveClass("modal-open", { message: "body should have modal-open class" });

    await click(document, "body .modal footer button.btn-primary");

    expect(["unlink"]).toVerifySteps();

    expect("tbody td.o_list_record_selector").toHaveCount(3, { message: "should have 3 records" });
});

test("custom delete confirmation dialog", async () => {
    const listView = registry.category("views").get("list");
    class CautiousController extends listView.Controller {
        get deleteConfirmationDialogProps() {
            const props = super.deleteConfirmationDialogProps;
            props.body = markup(`<span class="text-danger">These are the consequences</span><br/>${props.body}`);
            return props;
        }
    }
    registry.category("views").add("caution", {
        ...listView,
        Controller: CautiousController,
    });

    await mountView({
        resModel: "foo",
        type: "list",
        arch: `
            <tree js_class="caution">
                <field name="foo"/>
            </tree>
        `,
        actionMenus: {},
    });

    await click(target.querySelector("tbody td.o_list_record_selector:first-child input"));
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    expect(".modal:contains('you sure') .text-danger:contains('consequences')").toHaveCount(1, { message: "confirmation dialog should have markup and more" });

    await click(document, "body .modal footer button.btn-secondary");
    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "nothing deleted, 4 records remain" });
});

test("deleting record which throws UserError should close confirmation dialog", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (args.method === "unlink") {
                return Promise.reject({ message: "Odoo Server Error" });
            }
        },
    });

    await click(target.querySelector("tbody td.o_list_record_selector:first-child input"));

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    expect(".modal").toHaveCount(1, { message: "should have open the confirmation dialog" });

    await click(document, "body .modal footer button.btn-primary");
    expect(".modal").toHaveCount(0, { message: "confirmation dialog should be closed" });
});

test("delete all records matching the domain", async () => {
    assert.expect(6);

    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        domain: [["bar", "=", true]],
        mockRPC(route, args) {
            if (args.method === "unlink") {
                expect(args.args[0]).toEqual([1, 2, 3, 5]);
            }
        },
        actionMenus: {},
    });
    patchWithCleanup(list.env.services.notification, {
        add: () => {
            throw new Error("should not display a notification");
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(2, { message: "should have 2 records" });

    await click(target.querySelector("thead .o_list_record_selector input"));

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);

    await contains(".o_list_selection_box .o_list_select_domain").click();
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");

    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document, "body .modal footer button.btn-primary");
});

test("delete all records matching the domain (limit reached)", async () => {
    assert.expect(8);

    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });
    serverData.models.foo.records.push({ id: 6, bar: true, foo: "yyy" });

    patchWithCleanup(session, {
        active_ids_limit: 4,
    });
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        domain: [["bar", "=", true]],
        mockRPC(route, args) {
            if (args.method === "unlink") {
                expect(args.args[0]).toEqual([1, 2, 3, 5]);
            }
        },
        actionMenus: {},
    });
    patchWithCleanup(list.env.services.notification, {
        add: () => {
            assert.step("notify");
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(2, { message: "should have 2 records" });

    await click(target.querySelector("thead .o_list_record_selector input"));

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);

    await click(target.querySelector(".o_list_selection_box .o_list_select_domain"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");

    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document, "body .modal footer button.btn-primary");

    expect(["notify"]).toVerifySteps();
});

test("duplicate one record", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="top"><field name="foo"/></tree>`,
        actionMenus: {},
    });

    // Initial state: there should be 4 records
    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });

    // Duplicate one record
    await click(target.querySelector(".o_data_row input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Duplicate");

    // Final state: there should be 5 records
    expect("tbody tr").toHaveCount(5, { message: "should have 5 rows" });
});

test("duplicate all records", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="top"><field name="foo"/></tree>`,
        actionMenus: {},
    });

    // Initial state: there should be 4 records
    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });

    // Duplicate all records
    await click(target.querySelector(".o_list_record_selector input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Duplicate");

    // Final state: there should be 8 records
    expect("tbody tr").toHaveCount(8, { message: "should have 8 rows" });
});

test("archiving one record", async () => {
    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = { string: "Active", type: "boolean", default: true };

    await mountView({
        type: "list",
        resModel: "foo",
        actionMenus: {},
        arch: '<tree><field name="foo"/></tree>',
        mockRPC(route) {
            assert.step(route);
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "should have 4 records" });

    await click(target.querySelector("tbody td.o_list_record_selector:first-child input"));

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");

    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document, ".modal-footer .btn-secondary");
    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "still should have 4 records" });

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");
    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document, ".modal-footer .btn-primary");
    expect("tbody td.o_list_record_selector").toHaveCount(3, { message: "should have 3 records" });
    expect(["/web/dataset/call_kw/foo/action_archive", "/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
});

test("archive all records matching the domain", async () => {
    assert.expect(6);
    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = { string: "Active", type: "boolean", default: true };
    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        domain: [["bar", "=", true]],
        mockRPC(route, args) {
            if (args.method === "action_archive") {
                expect(args.args[0]).toEqual([1, 2, 3, 5]);
            }
        },
        actionMenus: {},
    });
    patchWithCleanup(list.env.services.notification, {
        add: () => {
            throw new Error("should not display a notification");
        },
        loadActionMenus: true,
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(2, { message: "should have 2 records" });

    await contains("thead .o_list_record_selector input").click();

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);

    await contains(".o_list_selection_box .o_list_select_domain").click();
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");

    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document, ".modal-footer .btn-primary");
});

test("archive all records matching the domain (limit reached)", async () => {
    assert.expect(8);

    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = { string: "Active", type: "boolean", default: true };
    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });
    serverData.models.foo.records.push({ id: 6, bar: true, foo: "yyy" });

    patchWithCleanup(session, {
        active_ids_limit: 4,
    });
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        domain: [["bar", "=", true]],
        mockRPC(route, args) {
            if (args.method === "action_archive") {
                expect(args.args[0]).toEqual([1, 2, 3, 5]);
            }
        },
        actionMenus: {},
    });

    patchWithCleanup(list.env.services.notification, {
        add: () => {
            assert.step("notify");
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect("tbody td.o_list_record_selector").toHaveCount(2, { message: "should have 2 records" });

    await contains("thead .o_list_record_selector input").click();

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);

    await contains(".o_list_selection_box .o_list_select_domain").click();
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");

    expect($(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });
    await click(document.querySelector(".modal-footer .btn-primary"));

    expect(["notify"]).toVerifySteps();
});

test("archive/unarchive handles returned action", async () => {
    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = { string: "Active", type: "boolean", default: true };

    serverData.actions = {
        11: {
            id: 11,
            name: "Action 11",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [9, "search"],
        },
    };
    serverData.views = {
        "foo,3,list": '<tree><field name="foo"/></tree>',
        "foo,9,search": `
            <search>
                <filter string="Not Bar" name="not bar" domain="[['bar','=',False]]"/>
            </search>`,
        "bar,false,form": '<form><field name="display_name"/></form>',
    };

    const mockRPC = (route) => {
        if (route === "/web/dataset/call_kw/foo/action_archive") {
            return {
                type: "ir.actions.act_window",
                name: "Archive Action",
                res_model: "bar",
                view_mode: "form",
                target: "new",
                views: [[false, "form"]],
            };
        }
    };

    const webClient = await createWebClient({ serverData, mockRPC });
    await doAction(webClient, 11);

    expect("tbody td.o_list_record_selector").toHaveCount(4, { message: "should have 4 records" });

    await click(target.querySelector("tbody td.o_list_record_selector input"));
    expect(".o_cp_action_menus").toHaveCount(1, { message: "sidebar should be visible" });

    await click(target.querySelector(".o_cp_action_menus .dropdown-toggle"));
    const archiveItem = [...target.querySelectorAll(".o-dropdown--menu .o_menu_item")].filter((elem) => elem.textContent === "Archive");
    await click(archiveItem[0]);
    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });

    await click(document.querySelector(".modal .modal-footer .btn-primary"));
    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "archive action dialog should be displayed" });
    expect(document.querySelector(".modal .modal-title").textContent.trim()).toBe("Archive Action", { message: "action wizard should have been opened" });
});

test("apply custom static action menu (archive)", async () => {
    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = { string: "Active", type: "boolean", default: true };

    const listView = registry.category("views").get("list");
    class CustomListController extends listView.Controller {
        getStaticActionMenuItems() {
            const menuItems = super.getStaticActionMenuItems();
            menuItems.archive.callback = () => {
                assert.step("customArchive");
            };
            return menuItems;
        }
    }
    registry.category("views").add("custom_list", {
        ...listView,
        Controller: CustomListController,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree js_class="custom_list">
                <field name="foo"/>
            </tree>`,
        actionMenus: {},
    });
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await contains("thead .o_list_record_selector input").click();
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");
    expect(["customArchive"]).toVerifySteps();
});

test("add custom static action menu", async () => {
    const listView = registry.category("views").get("list");
    class CustomListController extends listView.Controller {
        getStaticActionMenuItems() {
            const menuItems = super.getStaticActionMenuItems();
            menuItems.customAvailable = {
                isAvailable: () => true,
                description: "Custom Available",
                sequence: 35,
                callback: () => {
                    assert.step("Custom Available");
                },
            };
            menuItems.customNotAvailable = {
                isAvailable: () => false,
                description: "Custom Not Available",
                callback: () => {
                    assert.step("Custom Not Available");
                },
            };
            menuItems.customDefaultAvailable = {
                description: "Custom Default Available",
                callback: () => {
                    assert.step("Custom Default Available");
                },
            };
            return menuItems;
        }
    }
    registry.category("views").add("custom_list", {
        ...listView,
        Controller: CustomListController,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree js_class="custom_list">
                <field name="foo"/>
            </tree>`,
        actionMenus: {},
    });
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await contains("thead .o_list_record_selector input").click();
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    expect(getNodesTextContent(target.querySelectorAll(".o-dropdown--menu .dropdown-item"))).toEqual(["Custom Default Available", "Export", "Duplicate", "Custom Available", "Delete"]);

    await toggleMenuItem(target, "Custom Available");
    expect(["Custom Available"]).toVerifySteps();

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Default Available");
    expect(["Custom Default Available"]).toVerifySteps();
});

test("grouped, update the count of the group (and ancestors) when a record is deleted", async () => {
    serverData.models.foo.records = [
        { id: 121, foo: "blip", bar: true },
        { id: 122, foo: "blip", bar: true },
        { id: 123, foo: "blip", bar: true },
        { id: 124, foo: "blip", bar: true },
        { id: 125, foo: "blip", bar: false },
        { id: 126, foo: "blip", bar: false },
    ];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: /*xml*/ `
                <tree expand="1">
                    <field name="foo"/>
                </tree>`,
        groupBy: ["foo", "bar"],
        actionMenus: {},
    });
    expect(target.querySelector(".o_group_header:first-child").textContent.trim()).toBe("blip (6)");
    expect(target.querySelector(".o_group_header:nth-child(2)").textContent.trim()).toBe("No (2)");

    const secondNestedGroup = target.querySelector(".o_group_header:nth-child(3)");
    expect(secondNestedGroup.textContent.trim()).toBe("Yes (4)");
    await click(secondNestedGroup);
    expect(".o_data_row").toHaveCount(4);

    await click(target.querySelector(".o_data_row input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    await contains(".modal .btn-primary").click();
    expect(target.querySelector(".o_group_header:first-child").textContent.trim()).toBe("blip (5)");
    expect(target.querySelector(".o_group_header:nth-child(3)").textContent.trim()).toBe("Yes (3)");
});

test("pager (ungrouped and grouped mode), default limit", async () => {
    assert.expect(4);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        searchViewArch: `
            <search>
                <filter name="bar" string="bar" context="{'group_by': 'bar'}"/>
            </search>`,
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                expect(args.kwargs.limit).toBe(80, { message: "default limit should be 80 in List" });
            }
        },
    });

    expect("div.o_control_panel .o_cp_pager .o_pager").toHaveCount(1);
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Bar");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("2");
});

test("pager, ungrouped, with count limit reached", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });

    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    await click(target.querySelector(".o_pager_limit"));
    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    expect(["search_count"]).toVerifySteps();

    expectedCountLimit = undefined;
    await click(target.querySelector(".o_pager_next"));
    expect(["web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, with count limit reached, click next", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });

    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    expectedCountLimit = 5;
    await click(target.querySelector(".o_pager_next"));
    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("3-4");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    expect(["web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, with count limit reached, click next (2)", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });

    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    expectedCountLimit = 5;
    await click(target.querySelector(".o_pager_next"));
    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("3-4");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4+");
    expect(["web_search_read"]).toVerifySteps();

    expectedCountLimit = 7;
    await click(target.querySelector(".o_pager_next"));
    expect(".o_data_row").toHaveCount(1);
    expect(target.querySelector(".o_pager_value").innerText).toBe("5-5");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("5");
    expect(["web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, with count limit reached, click previous", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });

    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    expectedCountLimit = undefined;
    await click(target.querySelector(".o_pager_previous"));
    expect(".o_data_row").toHaveCount(1);
    expect(target.querySelector(".o_pager_value").innerText).toBe("5-5");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("5");
    expect(["search_count", "web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, with count limit reached, edit pager", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records.push({ id: 5, bar: true, foo: "xxx" });

    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    expectedCountLimit = 5;
    await contains(".o_pager_value").click();
    await contains("input.o_pager_value").edit("2-4");
    expect(".o_data_row").toHaveCount(3);
    expect(target.querySelector(".o_pager_value").innerText).toBe("2-4");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4+");
    expect(["web_search_read"]).toVerifySteps();

    expectedCountLimit = 15;
    await contains(".o_pager_value").click();
    await contains("input.o_pager_value").edit("2-14");
    expect(".o_data_row").toHaveCount(4);
    expect(target.querySelector(".o_pager_value").innerText).toBe("2-5");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("5");
    expect(["web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, with count equals count limit", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 4 });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    expect(["get_views", "web_search_read"]).toVerifySteps();
});

test("pager, ungrouped, reload while fetching count", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });

    const def = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        async mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "search_count") {
                await def;
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    await click(target.querySelector(".o_pager_limit"));
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["search_count"]).toVerifySteps();

    await reloadListView(target);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["web_search_read"]).toVerifySteps();

    def.resolve();
    await nextTick();
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect([]).toVerifySteps();
});

test("pager, ungrouped, next and fetch count simultaneously", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 5 });
    serverData.models.foo.records.push({ id: 11, foo: "r11", bar: true });
    serverData.models.foo.records.push({ id: 12, foo: "r12", bar: true });
    serverData.models.foo.records.push({ id: 13, foo: "r13", bar: true });

    let def;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        async mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                await def;
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("5+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    def = makeDeferred();
    await click(target.querySelector(".o_pager_next")); // this request will be pending
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("5+");
    // can't fetch count simultaneously as it is temporarily disabled while updating
    expect(".o_pager_limit").toHaveClass("disabled");
    expect(["web_search_read"]).toVerifySteps();

    def.resolve();
    await nextTick();
    expect(".o_pager_limit").not.toHaveClass("disabled");
});

test("pager, grouped, with groups count limit reached", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records.push({ id: 398, foo: "ozfijz" }); // to have 4 groups

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="2"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["foo"],
    });

    expect(".o_group_header").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
});

test("pager, grouped, with count limit reached", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="1"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["foo"],
    });

    expect(".o_group_header").toHaveCount(3, { message: "should have 3 groups" });
    expect(".o_group_header:first-of-type .o_group_name").toHaveCount(1, { message: "first group should have a name" });
    expect(".o_group_header:first-of-type .o_pager").toHaveCount(0, { message: "pager shouldn't be present until unfolded" });
    // unfold
    await click(target.querySelector(".o_group_header:first-of-type"));
    expect(".o_group_header:first-of-type .o_group_name .o_pager").toHaveCount(1, { message: "first group should have a pager" });
    expect(target.querySelector(".o_group_header:first-of-type .o_pager_value").innerText).toBe("1");
    expect(target.querySelector(".o_group_header:first-of-type .o_pager_limit").innerText).toBe("2");
});

test("multi-level grouped list, pager inside a group", async () => {
    serverData.models.foo.records.forEach((r) => (r.bar = true));
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2" groups_limit="3"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar", "foo"],
    });

    expect(".o_group_header").toHaveCount(1);

    await click(target.querySelector(".o_group_header"));
    expect(".o_group_header").toHaveCount(4);
    expect(".o_group_header:first-of-type .o_group_name .o_pager").toHaveCount(0);
});

test("count_limit attrs set in arch", async () => {
    let expectedCountLimit = 4;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2" count_limit="3"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "web_search_read") {
                expect(args.kwargs.count_limit).toBe(expectedCountLimit);
            }
        },
    });

    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("3+");
    expect(["get_views", "web_search_read"]).toVerifySteps();

    await click(target.querySelector(".o_pager_limit"));
    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-2");
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    expect(["search_count"]).toVerifySteps();

    expectedCountLimit = undefined;
    await click(target.querySelector(".o_pager_next"));
    expect(["web_search_read"]).toVerifySteps();
});

test("pager, grouped, pager limit should be based on the group's count", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records = [
        { id: 121, foo: "blip" },
        { id: 122, foo: "blip" },
        { id: 123, foo: "blip" },
        { id: 124, foo: "blip" },
        { id: 125, foo: "blip" },
        { id: 126, foo: "blip" },
    ];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["foo"],
    });

    // unfold
    await click(target.querySelector(".o_group_header:first-of-type"));
    expect(target.querySelector(".o_group_header:first-of-type .o_pager_limit").innerText).toBe("6");
});

test("pager, grouped, group pager should update after removing a filter", async () => {
    patchWithCleanup(RelationalModel, { DEFAULT_COUNT_LIMIT: 3 });
    serverData.models.foo.records = [
        { id: 121, foo: "aaa" },
        { id: 122, foo: "blip" },
        { id: 123, foo: "blip" },
        { id: 124, foo: "blip" },
        { id: 125, foo: "blip" },
        { id: 126, foo: "blip" },
    ];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/><field name="bar"/></tree>',
        searchViewArch: `
                <search>
                    <filter name="foo" domain="[('foo','=','aaa')]"/>
                    <filter name="groupby_foo" context="{'group_by': 'bar'}"/>
                </search>`,
    });

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Foo");
    await toggleMenuItem(target, "Bar");

    // expand group
    await contains("th.o_group_name").click();

    expect("th.o_group_name .o_pager_counter").toHaveCount(0);

    // remove filter
    await removeFacet(target);

    expect($(target).find("th.o_group_name:eq(0) .o_pager_counter").text().trim()).toBe("1-2 / 6");
});

test("grouped, show only limited records when the list view is initially expanded", async () => {
    const forcedDefaultLimit = 3;
    patchWithCleanup(RelationalModel, { DEFAULT_LIMIT: forcedDefaultLimit });

    serverData.models.foo.records = [
        { id: 121, foo: "blip" },
        { id: 122, foo: "blip" },
        { id: 123, foo: "blip" },
        { id: 124, foo: "blip" },
        { id: 125, foo: "blip" },
        { id: 126, foo: "blip" },
    ];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: /*xml*/ `
                <tree expand="1">
                    <field name="foo"/>
                </tree>`,
        groupBy: ["foo"],
    });

    assert.containsN(target, ".o_data_row", forcedDefaultLimit);
});

test("list keeps offset on switchView", async () => {
    assert.expect(3);
    serverData.views = {
        "foo,false,search": `<search />`,
        "foo,99,list": `<list limit="1"><field name="display_name" /></list>`,
        "foo,100,form": `<form><field name="display_name" /></form>`,
    };

    const offsets = [0, 1, 1];
    const mockRPC = async (route, args) => {
        if (args.method === "web_search_read") {
            expect(args.kwargs.offset).toBe(offsets.shift());
        }
    };
    const wc = await createWebClient({ serverData, mockRPC });
    await doAction(wc, {
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [99, "list"],
            [100, "form"],
        ],
    });
    await contains(".o_pager_next").click();
    await contains(".o_data_cell").click();
    await contains(".o_back_button").click();
});

test("Navigate between the list and kanban view using the command palette", async () => {
    serverData.views = {
        "foo,false,search": `<search />`,
        "foo,false,list": `<list><field name="display_name" /></list>`,
        "foo,false,kanban": `
            <kanban class="o_kanban_test">
                <templates><t t-name="kanban-box">
                    <div>
                        <field name="foo"/>
                    </div>
                </t></templates>
            </kanban>`,
    };
    registry.category("command_categories").add("view_switcher", {});

    const wc = await createWebClient({ serverData });
    await doAction(wc, {
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [false, "list"],
            [false, "kanban"],
        ],
    });
    expect(".o_cp_switch_buttons").toHaveCount(2, { message: "Should have 2 button (small and xl screens)" });
    expect(".o_switch_view").toHaveCount(2);
    expect(".o_list_view").toHaveCount(1);

    triggerHotkey("control+k");
    await nextTick();
    expect(".o_command_category .o_command").toHaveCount(1);
    let command = target.querySelector(".o_command_category .o_command");
    expect(command.textContent).toBe("Show Kanban view");

    await click(command);
    expect(".o_kanban_view").toHaveCount(1);

    triggerHotkey("control+k");
    await nextTick();
    expect(".o_command_category .o_command").toHaveCount(1);
    command = target.querySelector(".o_command_category .o_command");
    expect(command.textContent).toBe("Show List view");
    await click(command);
    expect(".o_list_view").toHaveCount(1);
});

test("can sort records when clicking on header", async () => {
    serverData.models.foo.fields.foo.sortable = true;

    let nbSearchRead = 0;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                nbSearchRead++;
            }
        },
    });

    expect(nbSearchRead).toBe(1, { message: "should have done one search_read" });
    assert.ok($(target).find("tbody tr:first td:contains(yop)").length, "record 1 should be first");
    assert.ok($(target).find("tbody tr:eq(3) td:contains(blip)").length, "record 3 should be first");

    nbSearchRead = 0;
    await click($(target).find("thead th:contains(Foo)")[0]);
    expect(nbSearchRead).toBe(1, { message: "should have done one search_read" });
    assert.ok($(target).find("tbody tr:first td:contains(blip)").length, "record 3 should be first");
    assert.ok($(target).find("tbody tr:eq(3) td:contains(yop)").length, "record 1 should be first");

    nbSearchRead = 0;
    await click($(target).find("thead th:contains(Foo)")[0]);
    expect(nbSearchRead).toBe(1, { message: "should have done one search_read" });
    assert.ok($(target).find("tbody tr:first td:contains(yop)").length, "record 3 should be first");
    assert.ok($(target).find("tbody tr:eq(3) td:contains(blip)").length, "record 1 should be first");
});

test("do not sort records when clicking on header with nolabel", async () => {
    serverData.models.foo.fields.foo.sortable = true;

    let nbSearchRead = 0;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo" nolabel="1"/><field name="int_field"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                nbSearchRead++;
            }
        },
    });

    expect(nbSearchRead).toBe(1, { message: "should have done one search_read" });
    expect($(target).find(".o_data_cell").text()).toBe("yop10blip9gnap17blip-4");

    await click(target.querySelectorAll("thead th")[2]);
    expect(nbSearchRead).toBe(2, { message: "should have done one other search_read" });
    expect($(target).find(".o_data_cell").text()).toBe("blip-4blip9yop10gnap17");

    await click(target.querySelectorAll("thead th")[1]);
    expect(nbSearchRead).toBe(2, { message: "shouldn't have done anymore search_read" });
    expect($(target).find(".o_data_cell").text()).toBe("blip-4blip9yop10gnap17");
});

test("use default_order", async () => {
    assert.expect(3);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree default_order="foo"><field name="foo"/><field name="bar"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                expect(args.kwargs.order).toBe("foo ASC", { message: "should correctly set the sort attribute" });
            }
        },
    });

    assert.ok($(target).find("tbody tr:first td:contains(blip)").length, "record 3 should be first");
    assert.ok($(target).find("tbody tr:eq(3) td:contains(yop)").length, "record 1 should be first");
});

test("use more complex default_order", async () => {
    assert.expect(3);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree default_order="foo, bar desc, int_field">' + '<field name="foo"/><field name="bar"/>' + "</tree>",
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                expect(args.kwargs.order).toBe("foo ASC, bar DESC, int_field ASC", { message: "should correctly set the sort attribute" });
            }
        },
    });

    assert.ok($(target).find("tbody tr:first td:contains(blip)").length, "record 3 should be first");
    assert.ok($(target).find("tbody tr:eq(3) td:contains(yop)").length, "record 1 should be first");
});

test("use default_order on editable tree: sort on save", async () => {
    serverData.models.foo.records[0].o2m = [1, 3];

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
            <form>
                <sheet>
                    <field name="o2m">
                        <tree editable="bottom" default_order="display_name">
                            <field name="display_name"/>
                        </tree>
                    </field>
                </sheet>
            </form>`,
        resId: 1,
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 3"]
    );

    await addRow(target);
    await contains(".o_field_widget[name=o2m] .o_field_widget input").edit("Value 2");
    await contains(".o_form_view").click();
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 3", "Value 2"]
    );

    await clickSave(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 2", "Value 3"]
    );
});

test("use default_order on editable tree: sort on demand", async () => {
    serverData.models.foo.records[0].o2m = [1, 3];
    serverData.models.bar.fields = {
        ...serverData.models.bar.fields,
        name: { string: "Name", type: "char", sortable: true },
    };
    serverData.models.bar.records[0].name = "Value 1";
    serverData.models.bar.records[2].name = "Value 3";

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
            <form>
                <sheet>
                    <field name="o2m">
                        <tree editable="bottom" default_order="name">
                            <field name="name"/>
                        </tree>
                    </field>
                </sheet>
            </form>`,
        resId: 1,
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 3"]
    );

    await addRow(target);
    await contains(".o_field_widget[name=o2m] .o_field_widget input").edit("Value 2");
    await contains(".o_form_view").click();
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 3", "Value 2"]
    );

    await contains(".o_field_widget[name=o2m] .o_column_sortable").click();
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 1", "Value 2", "Value 3"]
    );

    await contains(".o_field_widget[name=o2m] .o_column_sortable").click();
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_x2many_list .o_data_row")].map((el) => el.textContent),
        ["Value 3", "Value 2", "Value 1"]
    );
});

test("use default_order on editable tree: sort on demand in page", async () => {
    serverData.models.bar.fields = {
        ...serverData.models.bar.fields,
        name: { string: "Name", type: "char", sortable: true },
    };

    const ids = [];
    for (let i = 0; i < 45; i++) {
        const id = 4 + i;
        ids.push(id);
        serverData.models.bar.records.push({
            id: id,
            name: "Value " + (id < 10 ? "0" : "") + id,
        });
    }
    serverData.models.foo.records[0].o2m = ids;

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
                <form>
                    <sheet>
                        <field name="o2m">
                            <tree editable="bottom" default_order="name">
                                <field name="name"/>
                            </tree>
                        </field>
                    </sheet>
                </form>`,
        resId: 1,
    });

    await pagerNext(target.querySelector(".o_field_widget[name=o2m]"));
    expect(target.querySelector("tbody tr").textContent).toBe("Value 44", { message: "record 44 should be first" });
    expect(target.querySelectorAll("tbody tr")[4].textContent).toBe("Value 48", { message: "record 48 should be last" });

    await click(target.querySelector(".o_column_sortable"));
    expect(target.querySelector("tbody tr").textContent).toBe("Value 08", { message: "record 48 should be first" });
    expect(target.querySelectorAll("tbody tr")[4].textContent).toBe("Value 04", { message: "record 44 should be first" });
});

test("can display button in edit mode", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <button name="notafield" type="object" icon="fa-asterisk" class="o_yeah"/>
            </tree>`,
    });
    expect("tbody button[name=notafield]").toHaveCount(4);
    expect("tbody button[name=notafield].o_yeah").toHaveCount(4, { message: "class o_yeah should be set on the four button" });

    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row button[name=notafield]").toHaveCount(1);
});

test("can display a list with a many2many field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree><field name="m2m"/></tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });
    expect(["get_views", "web_search_read"]).toVerifySteps();
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell"))).toEqual(["2 records", "3 records", "No records", "1 record"]);
});

test("display a tooltip on a field", async () => {
    patchWithCleanup(odoo, {
        debug: false,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="bar" widget="boolean_favorite"/>
            </tree>`,
    });

    await mouseEnter(target.querySelector("th[data-name=foo]"));
    await nextTick(); // GES: see next nextTick comment
    expect(target.querySelectorAll(".o-tooltip .o-tooltip--technical").length).toBe(0, { message: "should not have rendered a tooltip" });

    patchWithCleanup(odoo, {
        debug: true,
    });

    // it is necessary to rerender the list so tooltips can be properly created
    await reloadListView(target);
    await mouseEnter(target.querySelector("th[data-name=bar]"));
    await nextTick(); // GES: I had once an indetermist failure because of no tooltip, so for safety I add a nextTick.

    expect(target.querySelectorAll(".o-tooltip .o-tooltip--technical").length).toBe(1, { message: "should have rendered a tooltip" });

    assert.containsOnce(target, '.o-tooltip--technical>li[data-item="widget"]', "widget should be present for this field");

    expect(getNodesTextContent([target.querySelector('.o-tooltip--technical>li[data-item="widget"]')])).toEqual(["Widget:Favorite (boolean_favorite) "], { message: "widget description should be correct" });
});

test("support row decoration", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree decoration-info="int_field > 5">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr.text-info").toHaveCount(3, { message: "should have 3 columns with text-info class" });

    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
});

test("support row decoration (with unset numeric values)", async () => {
    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom" decoration-danger="int_field &lt; 0">' + '<field name="int_field"/>' + "</tree>",
    });

    await click($(".o_list_button_add:visible").get(0));
    expect("tr.o_data_row.text-danger").toHaveCount(0, { message: "the data row should not have .text-danger decoration (int_field is unset)" });

    await editInput(target, '[name="int_field"] input', "-3");
    expect("tr.o_data_row.text-danger").toHaveCount(1, { message: "the data row should have .text-danger decoration (int_field is negative)" });
});

test("support row decoration with date", async () => {
    serverData.models.foo.records[0].datetime = "2017-02-27 12:51:35";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree decoration-info="datetime == '2017-02-27 12:51:35'" decoration-danger="datetime &gt; '2017-02-27 12:51:35' and datetime &lt; '2017-02-27 10:51:35'">
                <field name="datetime"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr.text-info").toHaveCount(1, { message: "should have 1 columns with text-info class with good datetime" });

    expect("tbody tr.text-danger").toHaveCount(0, { message: "should have 0 columns with text-danger class with wrong timezone datetime" });

    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
});

test("support row decoration (decoration-bf)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree decoration-bf="int_field > 5">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr.fw-bold").toHaveCount(3, { message: "should have 3 columns with fw-bold class" });

    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
});

test("support row decoration (decoration-it)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree decoration-it="int_field > 5">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr.fst-italic").toHaveCount(3, { message: "should have 3 columns with fst-italic class" });

    expect("tbody tr").toHaveCount(4, { message: "should have 4 rows" });
});

test("support field decoration", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo" decoration-danger="int_field > 5"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr").toHaveCount(4);
    expect("tbody td.o_list_char").toHaveCount(4);
    expect("tbody td.text-danger").toHaveCount(3);
    expect("tbody td.o_list_number").toHaveCount(4);
    expect("tbody td.o_list_number.text-danger").toHaveCount(0);
});

test("support field decoration (decoration-bf)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo" decoration-bf="int_field > 5"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr").toHaveCount(4);
    expect("tbody td.o_list_char").toHaveCount(4);
    expect("tbody td.fw-bold").toHaveCount(3);
    expect("tbody td.o_list_number").toHaveCount(4);
    expect("tbody td.o_list_number.fw-bold").toHaveCount(0);
});

test("support field decoration (decoration-it)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo" decoration-it="int_field > 5"/>
                <field name="int_field"/>
            </tree>`,
    });

    expect("tbody tr").toHaveCount(4);
    expect("tbody td.o_list_char").toHaveCount(4);
    expect("tbody td.fst-italic").toHaveCount(3);
    expect("tbody td.o_list_number").toHaveCount(4);
    expect("tbody td.o_list_number.fst-italic").toHaveCount(0);
});

test("bounce create button when no data and click on empty area", async () => {
    patchWithCleanup(browser, {
        setTimeout: () => {},
    });
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        noContentHelp: "click to add a record",
        searchViewArch: `
                <search>
                    <filter name="Empty List" domain="[('id', '&lt;', 0)]"/>
                </search>`,
    });

    expect(".o_view_nocontent").toHaveCount(0);
    await contains(".o_list_view").click();
    expect(".o_list_button_add").not.toHaveClass("o_catch_attention");

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Empty List");
    expect(".o_view_nocontent").toHaveCount(1);

    await contains(".o_nocontent_help").click();
    expect(".o_list_button_add").toHaveClass("o_catch_attention");
});

test("no content helper when no data", async () => {
    const records = serverData.models.foo.records;

    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        noContentHelp: "click to add a partner",
    });
    expect(".o_view_nocontent").toHaveCount(1, { message: "should display the no content helper" });
    expect(".o_list_view table").toHaveCount(1, { message: "should have a table in the dom" });
    assert.deepEqual(
        [...target.querySelectorAll(".o_view_nocontent")].map((el) => el.textContent),
        ["click to add a partner"]
    );

    serverData.models.foo.records = records;
    await reloadListView(target);

    expect(".o_view_nocontent").toHaveCount(0, { message: "should not display the no content helper" });
});

test("no nocontent helper when no data and no help", async () => {
    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
    });

    expect(".o_view_nocontent").toHaveCount(0, { message: "should not display the no content helper" });
    expect("tr.o_data_row").toHaveCount(0, { message: "should not have any data row" });
    expect(".o_list_view table").toHaveCount(1, { message: "should have a table in the dom" });
});

test("empty list with sample data", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
                <field name="m2o"/>
                <field name="m2m" widget="many2many_tags"/>
                <field name="date"/>
                <field name="datetime"/>
            </tree>`,
        context: { search_default_empty: true },
        noContentHelp: "click to add a partner",
        searchViewArch: `
            <search>
                <filter name="empty" domain="[('id', '&lt;', 0)]"/>
                <filter name="True Domain" domain="[(1,'=',1)]"/>
                <filter name="False Domain" domain="[(1,'=',0)]"/>
            </search>`,
    });

    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);

    // Check list sample data
    const firstRow = target.querySelector(".o_data_row");
    const cells = firstRow.querySelectorAll(":scope > .o_data_cell");
    expect(cells[0].innerText.trim()).toBe("", { message: "Char field should yield an empty element" });
    assert.containsOnce(cells[1], ".o-checkbox", "Boolean field has been instantiated");
    assert.notOk(isNaN(cells[2].innerText.trim()), "Intger value is a number");
    assert.ok(cells[3].innerText.trim(), "Many2one field is a string");

    const firstM2MTag = cells[4].querySelector(":scope div.o_tag_badge_text").innerText.trim();
    assert.ok(firstM2MTag.length > 0, "Many2many contains at least one string tag");

    assert.ok(/\d{2}\/\d{2}\/\d{4}/.test(cells[5].innerText.trim()), "Date field should have the right format");
    assert.ok(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/.test(cells[6].innerText.trim()), "Datetime field should have the right format");

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "empty");
    await toggleMenuItem(target, "False Domain");
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(1);

    await toggleMenuItem(target, "False Domain");
    await toggleMenuItem(target, "True Domain");
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);
    expect(".o_nocontent_help").toHaveCount(0);
});

test("refresh empty list with sample data", async () => {
    serverData.views = {
        "foo,false,search": `
            <search>
                <filter name="empty" domain="[('id', '&lt;', 0)]"/>
            </search>`,
        "foo,false,list": `
            <tree sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
                <field name="m2o"/>
                <field name="m2m" widget="many2many_tags"/>
                <field name="date"/>
                <field name="datetime"/>
            </tree>`,
        "foo,false,kanban": "<kanban></kanban>",
    };

    const webClient = await createWebClient({ serverData });

    await doAction(webClient, {
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [false, "list"],
            [false, "kanban"],
        ],
        context: { search_default_empty: true },
        help: '<p class="hello">click to add a partner</p>',
    });
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);

    const textContent = target.querySelector(".o_list_view").textContent;
    await contains(".o_cp_switch_buttons .o_list").click();
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);
    expect(target.querySelector(".o_list_view").textContent).toBe(textContent);
});

test("empty list with sample data: toggle optional field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree sample="1">
                <field name="foo"/>
                <field name="m2o" optional="hide"/>
            </tree>`,
        domain: Domain.FALSE.toList(),
    });
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    assert.ok(target.querySelectorAll(".o_data_row").length > 0);
    expect("th").toHaveCount(3, { message: "should have 3 th, 1 for selector, 1 for foo and 1 for optional columns" });
    expect("table .o_optional_columns_dropdown").toHaveCount(1);

    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();

    await contains(".o-dropdown--menu span.dropdown-item:first-child label").click();

    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    assert.ok(target.querySelectorAll(".o_data_row").length > 0);
    expect("th").toHaveCount(4);
});

test("empty list with sample data: keyboard navigation", async () => {
    await mountView({
        type: "list",
        arch: `
            <tree sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
            </tree>`,
        domain: Domain.FALSE.toList(),
        resModel: "foo",
    });

    // Check keynav is disabled
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");

    // From search bar
    assert.hasClass(document.activeElement, "o_searchview_input");

    triggerHotkey("arrowdown");
    await nextTick();

    assert.hasClass(document.activeElement, "o_searchview_input");

    // From 'Create' button
    $(".o_list_button_add:visible").get(0).focus();

    assert.hasClass(document.activeElement, "o_list_button_add");

    triggerHotkey("arrowdown");
    await nextTick();

    assert.hasClass(document.activeElement, "o_list_button_add");

    triggerHotkey("tab");
    await nextTick();

    expect(".o-tooltip--string").toHaveCount(0);

    // From column header
    target.querySelector(':scope th[data-name="foo"]').focus();

    assert.ok(document.activeElement.dataset.name === "foo");

    triggerHotkey("arrowdown");
    await nextTick();

    assert.ok(document.activeElement.dataset.name === "foo");
});

test("empty list with sample data: group by date", async () => {
    await mountView({
        type: "list",
        arch: `
            <tree sample="1">
                <field name="date"/>
            </tree>`,
        domain: Domain.FALSE.toList(),
        resModel: "foo",
        groupBy: ["date:day"],
    });

    expect(".o_list_view .o_view_sample_data").toHaveCount(1);
    const groupHeaders = [...target.querySelectorAll(".o_group_header")];
    assert.ok(groupHeaders.length);

    await click(target.querySelector(".o_group_has_content.o_group_header"));
    expect(".o_data_row").toHaveCount(4);
});

test("non empty list with sample data", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
            </tree>`,
        domain: Domain.TRUE.toList(),
        context: { search_default_true_domain: true },
        searchViewArch: `
                <search>
                    <filter name="true_domain" domain="[(1,'=',1)]"/>
                    <filter name="false_domain" domain="[(1,'=',0)]"/>
                </search>`,
    });

    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "true_domain");
    await toggleMenuItem(target, "false_domain");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(0);
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
});

test("click on header in empty list with sample data", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
            </tree>`,
        domain: Domain.FALSE.toList(),
    });

    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);

    const content = target.querySelector(".o_list_view").textContent;

    await click(target.querySelector("tr .o_column_sortable"));
    expect(target.querySelector(".o_list_view").textContent).toBe(content, { message: "the content should still be the same" });
});

test("non empty editable list with sample data: delete all records", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top" sample="1">
                    <field name="foo"/>
                    <field name="bar"/>
                    <field name="int_field"/>
                </tree>`,
        domain: Domain.TRUE.toList(),
        noContentHelp: "click to add a partner",
        actionMenus: {},
    });

    // Initial state: all records displayed
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);
    expect(".o_nocontent_help").toHaveCount(0);

    // Delete all records
    await click(target.querySelector("thead .o_list_record_selector input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    await click(target.querySelector(".modal-footer .btn-primary"));

    // Final state: no more sample data, but nocontent helper displayed
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(1);
});

test("empty editable list with sample data: start create record and cancel", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" sample="1">
                <field name="foo"/>
                <field name="bar"/>
                <field name="int_field"/>
            </tree>`,
        domain: Domain.FALSE.toList(),
        noContentHelp: "click to add a partner",
    });

    // Initial state: sample data and nocontent helper displayed
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);

    // Start creating a record
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_data_row").toHaveCount(1);

    // Discard temporary record
    await click($(".o_list_button_discard:visible").get(0));

    // Final state: there should be no table, but the no content helper
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(1);
});

test("empty editable list with sample data: create and delete record", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top" sample="1">
                    <field name="foo"/>
                    <field name="bar"/>
                    <field name="int_field"/>
                </tree>`,
        domain: Domain.FALSE.toList(),
        noContentHelp: "click to add a partner",
        actionMenus: {},
    });

    // Initial state: sample data and nocontent helper displayed
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);

    // Start creating a record
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_data_row").toHaveCount(1);

    // Save temporary record
    await clickSave(target);
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(0);

    // Delete newly created record
    await click(target.querySelector(".o_data_row input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Delete");
    await click(target.querySelector(".modal-footer .btn-primary"));

    // Final state: there should be no table, but the no content helper
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(1);
});

test("empty editable list with sample data: create and duplicate record", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top" sample="1">
                    <field name="foo"/>
                    <field name="bar"/>
                    <field name="int_field"/>
                </tree>`,
        domain: [["int_field", "=", 0]],
        noContentHelp: "click to add a partner",
        actionMenus: {},
    });

    // Initial state: sample data and nocontent helper displayed
    expect(".o_list_view .o_content").toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);
    expect(".o_nocontent_help").toHaveCount(1);

    // Start creating a record
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_data_row").toHaveCount(1);

    // Save temporary record
    await clickSave(target);
    expect(".o_list_view .o_content").not.toHaveClass("o_view_sample_data");
    expect(".o_list_table").toHaveCount(1);
    expect(".o_data_row").toHaveCount(1);
    expect(".o_nocontent_help").toHaveCount(0);

    // Duplicate newly created record
    await click(target.querySelector(".o_data_row input"));
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Duplicate");

    // Final state: there should be 2 records
    expect(".o_list_view .o_content .o_data_row").toHaveCount(2, { message: "there should be 2 records" })
});

test("groupby node with a button", async () => {
    assert.expect(17);

    serverData.models.foo.fields.currency_id.groupable = true;
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <groupby name="currency_id">
                    <button string="Button 1" type="object" name="button_method"/>
                </groupby>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: (params) => {
            assert.step(params.name);
            expect(params.resId).toEqual(1, { message: "should call with correct id" });
            expect(params.resModel).toBe("res_currency", { message: "should call with correct model" });
            expect(params.name).toBe("button_method", { message: "should call correct method" });
            expect(params.type).toBe("object", { message: "should have correct type" });
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();
    expect("thead th:not(.o_list_record_selector)").toHaveCount(1, { message: "there should be only one column" });

    await groupByMenu(target, "currency_id");

    expect(["web_read_group"]).toVerifySteps();
    expect(".o_group_header").toHaveCount(2, { message: "there should be 2 group headers" });
    assert.containsNone(target, ".o_group_header button", 0, "there should be no button in the header");
    await contains(".o_group_header:first-child").click();
    expect(["web_search_read"]).toVerifySteps();
    expect(".o_group_header button").toHaveCount(1);

    await contains(".o_group_header:first-child button").click();
    expect(["button_method"]).toVerifySteps();
});

test("groupby node with a button in inner groupbys", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <groupby name="currency_id">
                    <button string="Button 1" type="object" name="button_method"/>
                </groupby>
            </tree>`,
        groupBy: ["bar", "currency_id"],
    });

    expect(".o_group_header").toHaveCount(2, { message: "there should be 2 group headers" });
    expect(".o_group_header button").toHaveCount(0);

    await contains(".o_group_header:first-child").click();
    expect(".o_list_view .o_group_header").toHaveCount(3);
    expect(".o_group_header button").toHaveCount(0);
    await contains(".o_group_header:nth-child(2)").click();
    expect(".o_group_header button").toHaveCount(1);
});

test("groupby node with a button with modifiers", async () => {
    assert.expect(16);
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <groupby name="currency_id">
                    <field name="position"/>
                    <button string="Button 1" type="object" name="button_method" invisible="position == 'after'"/>
                </groupby>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "web_read" && args.model === "res_currency") {
                expect(args.args).toEqual([[1, 2]]);
                expect(args.kwargs.specification).toEqual({ position: {} });
            }
        },
        groupBy: ["currency_id"],
    });

    expect(["get_views", "web_read_group", "web_read"]).toVerifySteps();
    expect(".o_group_header button").toHaveCount(0);
    expect(".o_data_row").toHaveCount(0);

    await contains(".o_group_header:nth-child(2)").click();
    expect(["web_search_read"]).toVerifySteps();
    expect(".o_group_header button").toHaveCount(0);
    expect(".o_data_row").toHaveCount(1);

    await contains(".o_group_header:first-child").click();
    expect(["web_search_read"]).toVerifySteps();
    expect(".o_group_header button").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);
});

test("groupby node with a button with modifiers using a many2one", async () => {
    serverData.models.res_currency.fields.m2o = {
        string: "Currency M2O",
        type: "many2one",
        relation: "bar",
    };
    serverData.models.res_currency.records[0].m2o = 1;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1">
                <field name="foo"/>
                <groupby name="currency_id">
                    <field name="m2o"/>
                    <button string="Button 1" type="object" name="button_method" invisible="not m2o"/>
                </groupby>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
        groupBy: ["currency_id"],
    });
    const groupHeaders = target.querySelectorAll(".o_group_header");
    assert.containsOnce(groupHeaders[0], "button");
    assert.containsNone(groupHeaders[1], "button");

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read", "web_read"]).toVerifySteps();
});

test("reload list view with groupby node", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1">
                <field name="foo"/>
                <groupby name="currency_id">
                    <field name="position"/>
                    <button string="Button 1" type="object" name="button_method" invisible="position == 'after'"/>
                </groupby>
            </tree>`,
        groupBy: ["currency_id"],
    });

    expect(".o_group_header button").toHaveCount(1);

    await reloadListView(target);
    expect(".o_group_header button").toHaveCount(1);
});

test("editable list view with groupby node and modifiers", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1" editable="bottom">
                <field name="foo"/>
                <groupby name="currency_id">
                    <field name="position"/>
                    <button string="Button 1" type="object" name="button_method" invisible="position == 'after'"/>
                </groupby>
            </tree>`,
        groupBy: ["currency_id"],
    });

    expect(".o_data_row:first").not.toHaveClass("o_selected_row", { message: "first row should be in readonly mode" });

    await click(target.querySelector(".o_data_row .o_data_cell"));
    expect(".o_data_row:first").toHaveClass("o_selected_row", { message: "the row should be in edit mode" });

    await triggerEvent(document.activeElement, null, "keydown", { key: "escape" });
    expect(".o_data_row:first").not.toHaveClass("o_selected_row", { message: "the row should be back in readonly mode" });
});

test("groupby node with edit button", async () => {
    assert.expect(1);

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1">
                <field name="foo"/>
                <groupby name="currency_id">
                    <button string="Button 1" type="edit" name="edit"/>
                </groupby>
            </tree>`,
        groupBy: ["currency_id"],
    });
    patchWithCleanup(list.env.services.action, {
        doAction: (action) => {
            assert.deepEqual(action, {
                context: { create: false },
                res_id: 2,
                res_model: "res_currency",
                type: "ir.actions.act_window",
                views: [[false, "form"]],
                flags: { mode: "edit" },
            });
        },
    });
    await click(target.querySelectorAll(".o_group_header button")[1]);
});

test("groupby node with subfields, and onchange", async () => {
    assert.expect(1);

    serverData.models.foo.onchanges = {
        foo: function () {},
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" expand="1">
                <field name="foo"/>
                <field name="currency_id"/>
                <groupby name="currency_id">
                    <field name="position" column_invisible="1"/>
                </groupby>
            </tree>`,
        groupBy: ["currency_id"],
        mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.deepEqual(
                    args.args[3],
                    {
                        currency_id: {
                            fields: {
                                display_name: {},
                            },
                        },
                        foo: {},
                    },
                    "onchange spec should not follow relation of many2one fields"
                );
            }
        },
    });
    await click(target.querySelector(".o_data_row .o_data_cell"));
    await contains(".o_field_widget[name=foo] input").edit("new value");
});

test("list view, editable, without data", async () => {
    serverData.models.foo.records = [];
    serverData.models.foo.fields.date.default = "2017-02-10";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="date"/>
                <field name="m2o"/>
                <field name="foo"/>
                <button type="object" icon="fa-plus-square" name="method"/>
            </tree>`,
        noContentHelp: "click to add a partner",
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
            }
        },
    });

    expect(".o_view_nocontent").toHaveCount(1, { message: "should have a no content helper displayed" });
    expect("div.table-responsive").toHaveCount(1, { message: "should have a div.table-responsive" });
    expect("table").toHaveCount(1, { message: "should have rendered a table" });

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_view_nocontent").toHaveCount(0, { message: "should not have a no content helper displayed" });
    expect("tbody tr").toHaveClass("o_selected_row", { message: "the date field td should be in edit mode" });
    expect(target.querySelector("tbody tr").querySelectorAll("td")[1].textContent).toBe("", { message: "the date field td should not have any content" });
    expect(target.querySelector("tr.o_selected_row .o_list_record_selector input").disabled).toBe(true, { message: "record selector checkbox should be disabled while the record is not yet created" });
    expect(target.querySelector(".o_list_button button").disabled).toBe(false, { message: "buttons should not be disabled while the record is not yet created" });

    await clickSave(target);
    expect(target.querySelector("tbody tr .o_list_record_selector input").disabled).toBe(false, { message: "record selector checkbox should not be disabled once the record is created" });
    expect(target.querySelector(".o_list_button button").disabled).toBe(false, { message: "buttons should not be disabled once the record is created" });
    expect(["web_save"]).toVerifySteps();
});

test("list view, editable, with a button", async () => {
    serverData.models.foo.records = [];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <button string="abc" icon="fa-phone" type="object" name="schedule_another_phonecall"/>
            </tree>`,
        mockRPC(route, { method }) {
            if (method === "web_save") {
                assert.step("web_save");
            } else if (route.startsWith("/web/dataset/call_button")) {
                assert.step("call_button");
                return true;
            }
        },
    });

    await click($(".o_list_button_add:visible").get(0));

    expect("table button i.o_button_icon.fa-phone").toHaveCount(1, { message: "should have rendered a button" });
    assert.notOk(target.querySelector("table button").disabled, "button should not be disabled when creating the record");

    await contains("table button").click();
    assert.verifySteps(["web_save", "call_button"], "clicking the button should save the record and then execute the action");
});

test("list view with a button without icon", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <button string="abc" type="object" name="schedule_another_phonecall"/>
            </tree>`,
    });

    expect(target.querySelector("table button").innerText).toBe("abc", { message: "should have rendered a button with string attribute as label" });
});

test("list view, editable, can discard", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
    });

    expect("td:not(.o_list_record_selector) input").toHaveCount(0, { message: "no input should be in the table" });
    expect(".o_list_button_discard").toHaveCount(0);

    await click(target.querySelector(".o_data_cell"));
    expect("td:not(.o_list_record_selector) input").toHaveCount(1, { message: "first cell should be editable" });
    expect(".o_list_button_discard").toHaveCount(2, { message: "Should have 2 discard button (small and xl screens)" });

    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));

    expect("td:not(.o_list_record_selector) input").toHaveCount(0, { message: "no input should be in the table" });
    expect(".o_list_button_discard").toHaveCount(0);
});

test("editable list view, click on the list to save", async () => {
    serverData.models.foo.fields.date.default = "2017-02-10";
    serverData.models.foo.records = [];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="int_field" sum="Sum"/>
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
            }
        },
    });

    await click($(".o_list_button_add:visible").get(0));
    await contains(".o_field_widget[name=foo] input").edit("new value");
    await click(target.querySelector(".o_list_renderer"));
    expect(["web_save"]).toVerifySteps();

    await click($(".o_list_button_add:visible").get(0));
    await contains(".o_field_widget[name=foo] input").edit("new value");
    await click(target.querySelector("tfoot"));
    expect(["web_save"]).toVerifySteps();

    await click($(".o_list_button_add:visible").get(0));
    await contains(".o_field_widget[name=foo] input").edit("new value");
    await click(target.querySelectorAll("tbody tr")[2].querySelector(".o_data_cell"));
    expect(["web_save"]).toVerifySteps();
});

test("editable list view, should refocus date field", async () => {
    patchDate(2017, 1, 10, 0, 0, 0);
    serverData.models.foo.records = [];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: /* xml */ `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="date"/>
            </tree>`,
    });
    await click($(".o_list_button_add:visible").get(0));
    expect(document.activeElement).toBe(target.querySelector(".o_field_widget[name=foo] input"));

    await contains(".o_field_widget[name=date] input").click();
    expect(document.activeElement).toBe(target.querySelector(".o_field_widget[name=date] input"));
    expect(".o_datetime_picker").toHaveCount(1);

    const clickPromise = click(getPickerCell("15"));
    getPickerCell("15").focus();
    await clickPromise;

    expect(".o_datetime_picker").toHaveCount(0);
    expect(target.querySelector(".o_field_widget[name=date] input").value).toBe("02/15/2017");
    expect(document.activeElement).toBe(target.querySelector(".o_field_widget[name=date] input"));
});

test("text field should keep it's selection when clicking on it", async () => {
    serverData.models.foo.records[0].text = "1234";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" limit="1">
                <field name="text"/>
            </tree>`,
    });

    await contains("td[name=text]").click();
    expect(window.getSelection().toString()).toBe("1234", { message: "the entire content should be selected on initial click" });

    Object.assign(target.querySelector("[name=text] textarea"), {
        selectionStart: 0,
        selectionEnd: 1,
    });

    await contains("[name=text] textarea").click();

    expect(window.getSelection().toString()).toBe("1", { message: "the selection shouldn't be changed" });
});

test("click on a button cell in a list view", async () => {
    serverData.models.foo.records[0].foo = "bar";
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" limit="1">
                <field name="foo"/>
                <button name="action_do_something" type="object" string="Action"/>
            </tree>`,
    });

    patchWithCleanup(list.env.services.action, {
        doActionButton: (action) => {
            assert.step("doActionButton");
            action.onClose();
        },
    });

    await click(target.querySelector(".o_data_cell.o_list_button"));
    expect(window.getSelection().toString()).toBe("bar", { message: "Focus should have returned to the editable cell without throwing an error" });
    expect(".o_selected_row").toHaveCount(1);
    expect([]).toVerifySteps();
});

test("click on a button in a list view", async () => {
    assert.expect(10);

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <button string="a button" name="button_action" icon="fa-car" type="object"/>
            </tree>`,
        mockRPC(route) {
            assert.step(route);
        },
    });
    patchWithCleanup(list.env.services.action, {
        doActionButton: (action) => {
            expect(action.resId).toEqual(1, { message: "should call with correct id" });
            expect(action.resModel).toBe("foo", { message: "should call with correct model" });
            expect(action.name).toBe("button_action", { message: "should call correct method" });
            expect(action.type).toBe("object", { message: "should have correct type" });
            action.onClose();
        },
    });

    expect("tbody .o_list_button").toHaveCount(4, { message: "there should be one button per row" });
    expect(".o_data_row .o_list_button .o_button_icon.fa.fa-car").toHaveCount(4);

    await click(target.querySelector(".o_data_row .o_list_button > button"));
    assert.verifySteps(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read", "/web/dataset/call_kw/foo/web_search_read"], "should have reloaded the view (after the action is complete)");
});

test("invisible attrs in readonly and editable list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <button string="a button" name="button_action" icon="fa-car" type="object" invisible="id == 1"/>
                <field name="int_field"/>
                <field name="qux"/>
                <field name="foo" invisible="id == 1"/>
            </tree>`,
    });

    expect(target.querySelectorAll(".o_field_cell")[2].innerHTML).toBe("");
    expect(target.querySelector(".o_data_cell.o_list_button").innerHTML).toBe("");

    // edit first row
    await click(target.querySelector(".o_field_cell"));
    expect(target.querySelectorAll(".o_field_cell")[2].innerHTML).toBe("");
    expect(target.querySelector(".o_data_cell.o_list_button").innerHTML).toBe("");

    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));

    // click on the invisible field's cell to edit first row
    await click(target.querySelectorAll(".o_field_cell")[2]);
    expect(".o_data_row").toHaveClass("o_selected_row");
});

test("monetary fields are properly rendered", async () => {
    const currencies = {};
    serverData.models.res_currency.records.forEach((currency) => {
        currencies[currency.id] = currency;
    });
    patchWithCleanup(session, { currencies });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="id"/>
                <field name="amount"/>
                <field name="currency_id" column_invisible="1"/>
            </tree>`,
    });

    expect("tbody tr:first td").toHaveCount(3, { message: "currency_id column should not be in the table" });
    expect(target.querySelector("tbody .o_data_row:first-child .o_data_cell:nth-child(3)").textContent.replace(/\s/g).toBe(" "), "1200.00 €", { message: "currency_id column should not be in the table" });
    expect(target.querySelector("tbody .o_data_row:nth-child(2) .o_data_cell:nth-child(3)").textContent.replace(/\s/g).toBe(" "), "$ 500.00", { message: "currency_id column should not be in the table" });
});

test("simple list with date and datetime", async () => {
    patchTimeZone(120);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="date"/><field name="datetime"/></tree>',
    });
    const cells = target.querySelectorAll(".o_data_row .o_data_cell");
    expect(cells[0].textContent).toBe("01/25/2017", { message: "should have formatted the date" });
    expect(cells[1].textContent).toBe("12/12/2016 12:55:05", { message: "should have formatted the datetime" });
});

test("edit a row by clicking on a readonly field", async () => {
    serverData.models.foo.fields.foo.readonly = true;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="int_field"/></tree>',
    });

    // edit the first row
    await click(target.querySelector(".o_field_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row", { message: "first row should be selected" });
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_readonly_modifier");
    expect(target.querySelector(".o_selected_row .o_field_widget[name=foo] span").innerText).toBe("yop", { message: "a widget should have been rendered for readonly fields" });
    expect(".o_selected_row .o_field_widget[name=int_field] input").toHaveCount(1, { message: "'int_field' should be editable" });

    // click again on readonly cell of first line: nothing should have changed
    await click(target.querySelector(".o_field_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_readonly_modifier");
    expect(".o_selected_row .o_field_widget[name=int_field] input").toHaveCount(1, { message: "'int_field' should be editable" });
});

test("list view with nested groups", async () => {
    assert.expect(40);

    serverData.models.foo.records.push({ id: 5, foo: "blip", int_field: -7, m2o: 1 });
    serverData.models.foo.records.push({ id: 6, foo: "blip", int_field: 5, m2o: 2 });

    let nbRPCs = { readGroup: 0, webSearchRead: 0 };
    let envIDs = []; // the ids that should be in the environment during this test

    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="id"/><field name="int_field"/></tree>',
        groupBy: ["m2o", "foo"],
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                if (args.kwargs.groupby[0] === "foo") {
                    // nested read_group
                    // called twice (once when opening the group, once when sorting)
                    expect(args.kwargs.domain).toEqual([["m2o", "=", 1]], { message: "nested read_group should be called with correct domain" });
                }
                nbRPCs.readGroup++;
            } else if (args.method === "web_search_read") {
                // called twice (once when opening the group, once when sorting)
                assert.deepEqual(
                    args.kwargs.domain,
                    [
                        ["foo", "=", "blip"],
                        ["m2o", "=", 1],
                    ],
                    "nested web_search_read should be called with correct domain"
                );
                nbRPCs.webSearchRead++;
            }
        },
        selectRecord: (resId, options) => {
            assert.step(`switch to form - resId: ${resId}`);
        },
    });

    expect(nbRPCs.readGroup).toBe(1, { message: "should have done one read_group" });
    expect(nbRPCs.webSearchRead).toBe(0, { message: "should have done no web_search_read" });
    assert.deepEqual(
        list.model.root.records.map((r) => r.resId),
        envIDs
    );

    // basic rendering tests
    expect(".o_group_header").toHaveCount(2, { message: "should contain 2 groups at first level" });
    const value1Group = getGroup(1);
    expect(value1Group.querySelector(".o_group_name").textContent.trim()).toBe("Value 1 (4)", { message: "group should have correct name and count" });
    expect(".o_group_name .fa-caret-right").toHaveCount(2, { message: "the carret of closed groups should be right" });
    expect(getCssVar(value1Group.querySelector("span")).toBe("--o-list-group-level").trim(), { message: "0" });
    expect([...value1Group.querySelectorAll("td")].pop().textContent).toBe("16", { message: "group aggregates are correctly displayed" });

    // open the first group
    nbRPCs = { readGroup: 0, webSearchRead: 0 };
    await click(value1Group);
    expect(nbRPCs.readGroup).toBe(1, { message: "should have done one read_group" });
    expect(nbRPCs.webSearchRead).toBe(0, { message: "should have done no web_search_read" });
    assert.deepEqual(
        list.model.root.records.map((r) => r.resId),
        envIDs
    );

    expect(getGroup(1).querySelector(".o_group_name").textContent.trim()).toBe("Value 1 (4)", { message: "group should have correct name and count (of records, not inner subgroups)" });
    expect(".o_group_name:first .fa-caret-down").toHaveCount(1, { message: "the carret of open groups should be down" });
    expect(target.querySelectorAll(".o_group_header").length).toBe(5, { message: "open group should contain 5 groups (2 groups and 3 subGroup)" });
    const blipGroup = getGroup(2);
    expect(blipGroup.querySelector(".o_group_name").textContent.trim()).toBe("blip (2)", { message: "group should have correct name and count" });
    expect(getCssVar(blipGroup.querySelector("span")).toBe("--o-list-group-level").trim(), { message: "1" });
    expect([...blipGroup.querySelectorAll("td")].pop().textContent).toBe("-11", { message: "inner group aggregates are correctly displayed" });

    // open subgroup
    nbRPCs = { readGroup: 0, webSearchRead: 0 };
    envIDs = [4, 5]; // the opened subgroup contains these two records
    await click(blipGroup);
    expect(nbRPCs.readGroup).toBe(0, { message: "should have done no read_group" });
    expect(nbRPCs.webSearchRead).toBe(1, { message: "should have done one web_search_read" });
    assert.deepEqual(
        list.model.root.records.map((r) => r.resId),
        envIDs
    );
    expect(target.querySelectorAll(".o_group_header").length).toBe(5, { message: "open group should contain 5 groups (2 groups and 3 subGroup)" });
    expect(target.querySelectorAll(".o_data_row").length).toBe(2, { message: "open subgroup should contain 2 data rows" });
    expect([...target.querySelector(".o_data_row").querySelectorAll(".o_data_cell")].pop().textContent).toBe("-4", { message: "first record in open subgroup should be res_id 4 (with int_field -4)" });

    // open a record (should trigger event 'open_record')
    await click(target.querySelector(".o_data_row .o_data_cell"));
    assert.verifySteps([`switch to form - resId: 4`]);

    // sort by int_field (ASC) and check that open groups are still open
    nbRPCs = { readGroup: 0, webSearchRead: 0 };
    envIDs = [5, 4]; // order of the records changed
    await click(target.querySelector(".o_list_view thead [data-name='int_field']"));
    expect(nbRPCs.readGroup).toBe(2, { message: "should have done two read_groups" });
    expect(nbRPCs.webSearchRead).toBe(1, { message: "should have done one web_search_read" });
    assert.deepEqual(
        list.model.root.records.map((r) => r.resId),
        envIDs
    );
    expect(target.querySelectorAll(".o_group_header").length).toBe(5, { message: "open group should contain 5 groups (2 groups and 3 subGroup)" });
    expect(target.querySelectorAll(".o_data_row").length).toBe(2, { message: "open subgroup should contain 2 data rows" });
    expect([...target.querySelector(".o_data_row").querySelectorAll(".o_data_cell")].pop().textContent).toBe("-7", { message: "first record in open subgroup should be res_id 5 (with int_field -7)" });

    // close first level group
    nbRPCs = { readGroup: 0, webSearchRead: 0 };
    envIDs = []; // the group being closed, there is no more record in the environment
    await click(getGroup(2));
    expect(nbRPCs.readGroup).toBe(0, { message: "should have done no read_group" });
    expect(nbRPCs.webSearchRead).toBe(0, { message: "should have done no web_search_read" });
    assert.deepEqual(
        list.model.root.records.map((r) => r.resId),
        envIDs
    );

    expect(".o_group_header").toHaveCount(2, { message: "should contain 2 groups at first level" });
    expect(".o_group_name .fa-caret-right").toHaveCount(2, { message: "the carret of closed groups should be right" });
});

test("grouped list on selection field at level 2", async () => {
    serverData.models.foo.fields.priority = {
        string: "Priority",
        type: "selection",
        selection: [
            [1, "Low"],
            [2, "Medium"],
            [3, "High"],
        ],
        default: 1,
    };
    serverData.models.foo.records.push({
        id: 5,
        foo: "blip",
        int_field: -7,
        m2o: 1,
        priority: 2,
    });
    serverData.models.foo.records.push({
        id: 6,
        foo: "blip",
        int_field: 5,
        m2o: 1,
        priority: 3,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="id"/><field name="int_field"/></tree>',
        groupBy: ["m2o", "priority"],
    });

    expect(".o_group_header").toHaveCount(2, { message: "should contain 2 groups at first level" });

    // open the first group
    await click(target.querySelector(".o_group_header"));
    expect(".o_group_header").toHaveCount(5, { message: "should contain 2 groups at first level and 3 groups at second level" });
    assert.deepEqual(
        [...target.querySelectorAll(".o_group_header .o_group_name")].map((el) => el.innerText),
        ["Value 1 (5)", "Low (3)", "Medium (1)", "High (1)", "Value 2 (1)"]
    );
});

test("grouped list with a pager in a group", async () => {
    serverData.models.foo.records[3].bar = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
        limit: 3,
    });
    const headerHeight = target.querySelector(".o_group_header").offsetHeight;
    // basic rendering checks
    await click(target.querySelector(".o_group_header"));
    expect(target.querySelector(".o_group_header").offsetHeight).toBe(headerHeight, { message: "height of group header shouldn't have changed" });
    expect(".o_group_header th nav").toHaveClass("o_pager", { message: "last cell of open group header should have classname 'o_pager'" });
    expect(getPagerValue(target.querySelector(".o_group_header"))).toEqual([1, 3]);
    expect(".o_data_row").toHaveCount(3);

    // go to next page
    await pagerNext(target.querySelector(".o_group_header"));
    expect(getPagerValue(target.querySelector(".o_group_header"))).toEqual([4, 4]);
    expect(".o_data_row").toHaveCount(1);
});

test("edition: create new line, then discard", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
    });

    expect("tr.o_data_row").toHaveCount(4, { message: "should have 4 records" });
    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
    expect(".o_list_button_discard").toHaveCount(0);
    expect(".o_list_record_selector input:enabled").toHaveCount(5);
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_list_button_add").toHaveCount(0);
    expect(".o_list_button_discard").toHaveCount(2, { message: "Should have 2 discard button (small and xl screens)" });
    expect(".o_list_record_selector input:enabled").toHaveCount(0);
    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));
    expect("tr.o_data_row").toHaveCount(4, { message: "should still have 4 records" });
    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
    expect(".o_list_button_discard").toHaveCount(0);
    expect(".o_list_record_selector input:enabled").toHaveCount(5);
});

test("invisible attrs on fields are re-evaluated on field change", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo" invisible="bar"/>
                    <field name="bar"/>
                </tree>`,
    });

    let fooCells = target.querySelectorAll(".o_data_cell.o_list_char");
    assert.deepEqual(
        [...fooCells].map((c) => c.innerText),
        ["", "", "", "blip"]
    );

    // Make first line editable
    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row .o_list_char .o_field_widget[name=foo]").toHaveCount(0);

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_list_char .o_field_widget[name=foo]").toHaveCount(1);
    expect(target.querySelector(".o_list_char input").value).toBe("yop");
    fooCells = target.querySelectorAll(".o_data_cell.o_list_char");
    assert.deepEqual(
        [...fooCells].map((c) => c.innerText),
        ["", "", "", "blip"]
    );

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_list_char .o_field_widget[name=foo]").toHaveCount(0);
    fooCells = target.querySelectorAll(".o_data_cell.o_list_char");
    assert.deepEqual(
        [...fooCells].map((c) => c.innerText),
        ["", "", "", "blip"]
    );

    // Reswitch the field to visible and save the row
    await click(target.querySelector(".o_field_widget[name=bar] input"));
    await click($(".o_list_button_save:visible").get(0));

    target.querySelectorAll(".o_data_cell.o_list_char");
    assert.deepEqual(
        [...fooCells].map((c) => c.innerText),
        ["yop", "", "", "blip"]
    );
});

test("readonly attrs on fields are re-evaluated on field change", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo" readonly="bar"/>
                    <field name="bar"/>
                </tree>`,
    });

    // Make first line editable
    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo] span").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_readonly_modifier");

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo] input").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_readonly_modifier");

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo] span").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_readonly_modifier");

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo] input").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_readonly_modifier");

    // Click outside to leave edition mode and make first line editable again
    await click(target);
    expect(".o_selected_row").toHaveCount(0);
    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo] input").toHaveCount(1);
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_readonly_modifier");
});

test("required attrs on fields are re-evaluated on field change", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo" required="bar"/>
                    <field name="bar"/>
                </tree>`,
    });

    // Make first line editable
    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_required_modifier");

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_required_modifier");

    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_required_modifier");

    // Reswitch the field to required and save the row and make first line editable again
    await click(target.querySelector(".o_field_widget[name=bar] input"));
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_required_modifier");
    await click($(".o_list_button_save:visible").get(0));
    await click(target.querySelector(".o_field_cell"));
    expect(".o_selected_row .o_field_widget[name=foo]").not.toHaveClass("o_required_modifier");
});

test("modifiers of other x2many rows a re-evaluated when a subrecord is updated", async () => {
    // In an x2many, a change on a subrecord might trigger an onchange on the x2many that
    // updates other sub-records than the edited one. For that reason, modifiers must be
    // re-evaluated.
    serverData.models.foo.onchanges = {
        o2m: function (obj) {
            obj.o2m = [
                [1, 1, { display_name: "Value 1", stage: "open" }],
                [1, 2, { display_name: "Value 2", stage: "draft" }],
            ];
        },
    };

    serverData.models.bar.fields.stage = {
        string: "Stage",
        type: "selection",
        selection: [
            ["draft", "Draft"],
            ["open", "Open"],
        ],
    };

    serverData.models.foo.records[0].o2m = [1, 2];
    serverData.models.bar.records[0].stage = "draft";
    serverData.models.bar.records[1].stage = "open";

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
                <form>
                    <field name="o2m">
                        <tree editable="top">
                            <field name="display_name" invisible="stage == 'open'"/>
                            <field name="stage"/>
                        </tree>
                    </field>
                </form>`,
        resId: 1,
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_widget[name=o2m] .o_data_row .o_data_cell:first-child")].map((el) => el.innerText),
        ["Value 1", ""]
    );

    // Make a change in the list to trigger the onchange
    await click(target.querySelector(".o_field_widget[name=o2m] .o_data_row .o_data_cell:nth-child(2)"));
    await editSelect(target, '.o_field_widget[name=o2m] .o_data_row [name="stage"] select', '"open"');
    assert.deepEqual(
        [...target.querySelectorAll(".o_field_widget[name=o2m] .o_data_row .o_data_cell:first-child")].map((el) => el.innerText),
        ["", "Value 2"]
    );
    expect(target.querySelector(".o_data_row:nth-child(2)").textContent).toBe("Value 2Draft", { message: "the onchange should have been applied" });
});

test("leaving unvalid rows in edition", async () => {
    let warnings = 0;
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo" required="1"/>
                <field name="bar"/>
            </tree>`,
    });
    patchWithCleanup(list.env.services.notification, {
        add: (message, { type }) => {
            if (type === "danger") {
                warnings++;
            }
        },
    });

    // Start first line edition
    await click(target.querySelector(".o_data_cell"));

    // Remove required foo field value
    await editInput(target, ".o_selected_row .o_field_widget[name=foo] input", "");

    // Try starting other line edition
    await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row", { message: "first line should still be in edition as invalid" });
    expect(".o_selected_row").toHaveCount(1, { message: "no other line should be in edition" });
    assert.containsOnce(queryFirst(".o_data_row"), ".o_field_invalid input", "the required field should be marked as invalid");
    expect(warnings).toBe(1, { message: "a warning should have been displayed" });
});

test("open a virtual id", async () => {
    await mountView({
        type: "list",
        resModel: "event",
        arch: '<tree><field name="name"/></tree>',
        selectRecord: (resId, options) => {
            assert.step(`switch to form - resId: ${resId}`);
        },
    });
    await click(target.querySelector(".o_data_row .o_data_cell"));
    assert.verifySteps([`switch to form - resId: 2-20170808020000`]);
});

test("pressing enter on last line of editable list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="bottom"><field name="foo"/></tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();
    expect("tr.o_data_row").toHaveCount(4);

    // click on 3rd line
    await click(target.querySelector("tr.o_data_row:nth-child(3) .o_field_cell[name=foo]"));
    expect("tr.o_data_row:nth-child(3)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_selected_row [name=foo] input"));

    // press enter in input
    triggerHotkey("Enter");
    await nextTick();
    expect("tr.o_data_row:nth-child(4)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_selected_row [name=foo] input"));

    // press enter on last row
    triggerHotkey("Enter");
    await nextTick();
    expect("tr.o_data_row").toHaveCount(5);
    expect("tr.o_data_row:nth-child(5)").toHaveClass("o_selected_row");

    expect(["onchange"]).toVerifySteps();
});

test("pressing tab on last cell of editable list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="int_field"/></tree>',
        mockRPC(route) {
            assert.step(route);
        },
    });
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[3].querySelector(".o_data_cell"));
    expect(document.activeElement.parentNode.getAttribute("name")).toBe("foo", { message: "focus should be on an input with name = foo" });

    //it will not create a new line unless a modification is made
    await editInput(document.activeElement, null, "blip-changed");
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement.parentNode.getAttribute("name")).toBe("int_field", { message: "focus should be on an input with name = int_field" });

    triggerHotkey("Tab");
    await nextTick();
    expect("tr.o_data_row:eq(4)").toHaveClass("o_selected_row", { message: "5th row should be selected" });
    expect(document.activeElement.parentNode.getAttribute("name")).toBe("foo", { message: "focus should be on an input with name = foo" });

    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read", "/web/dataset/call_kw/foo/web_save", "/web/dataset/call_kw/foo/onchange"]).toVerifySteps();
});

test("navigation with tab and read completes after default_get", async () => {
    const onchangeGetPromise = makeDeferred();
    const readPromise = makeDeferred();

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="int_field"/></tree>',
        mockRPC(route, args, performRPC) {
            assert.step(args.method);
            const result = performRPC(route, args);
            if (args.method === "web_save") {
                return readPromise.then(function () {
                    return result;
                });
            }
            if (args.method === "onchange") {
                return onchangeGetPromise.then(function () {
                    return result;
                });
            }
            return result;
        },
    });

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[3].querySelectorAll(".o_data_cell")[1]);

    await contains(".o_selected_row [name='int_field'] input").edit("1234");
    triggerHotkey("Tab");
    await nextTick();

    onchangeGetPromise.resolve();
    expect("tbody tr.o_data_row").toHaveCount(4, { message: "should have 4 data rows" });

    readPromise.resolve();
    await nextTick();
    expect("tbody tr.o_data_row").toHaveCount(5, { message: "should have 5 data rows" });
    expect("td:contains(1234)").toHaveCount(1, { message: "should have a cell with new value" });

    // we trigger a tab to move to the second cell in the current row. this
    // operation requires that this.currentRow is properly set in the
    // list editable renderer.
    triggerHotkey("Tab");
    await nextTick();
    expect("tr.o_data_row:eq(4)").toHaveClass("o_selected_row", { message: "5th row should be selected" });

    expect(["get_views", "web_search_read", "web_save", "onchange"]).toVerifySteps();
});

test("display toolbar", async () => {
    await mountView({
        type: "list",
        resModel: "event",
        arch: '<tree><field name="name"/></tree>',
        info: {
            actionMenus: {
                action: [
                    {
                        id: 29,
                        name: "Action event",
                    },
                ],
            },
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await click(target.querySelector(".o_list_record_selector input"));
    await toggleActionMenu(target);
    expect(getNodesTextContent(target.querySelectorAll(".o-dropdown--menu .dropdown-item"))).toEqual(["Export", "Duplicate", "Delete", "Action event"]);
});

test("execute ActionMenus actions", async () => {
    patchWithCleanup(actionService, {
        start() {
            return {
                doAction(id, { additionalContext, onClose }) {
                    assert.step(JSON.stringify({ action_id: id, context: additionalContext }));
                    onClose(); // simulate closing of target new action's dialog
                },
            };
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        info: {
            actionMenus: {
                action: [
                    {
                        id: 44,
                        name: "Custom Action",
                        type: "ir.actions.act_window",
                        target: "new",
                    },
                ],
                print: [],
            },
        },
        actionMenus: {},
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);
    // select all records
    await contains("thead .o_list_record_selector input").click();
    expect(".o_list_record_selector input:checked").toHaveCount(5);
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    assert.verifySteps(["get_views", "web_search_read", `{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2,3,4],"active_model":"foo","active_domain":[]}}`, "web_search_read"]);
});

test("execute ActionMenus actions with correct params (single page)", async () => {
    assert.expect(12);

    patchWithCleanup(actionService, {
        start() {
            const result = super.start(...arguments);
            return {
                ...result,
                doAction(id, { additionalContext }) {
                    assert.step(JSON.stringify({ action_id: id, context: additionalContext }));
                },
            };
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        info: {
            actionMenus: {
                action: [
                    {
                        id: 44,
                        name: "Custom Action",
                        type: "ir.actions.server",
                    },
                ],
                print: [],
            },
        },
        actionMenus: {},
        searchViewArch: `
                <search>
                    <filter name="bar" domain="[('bar', '=', true)]"/>
                </search>`,
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_data_row").toHaveCount(4);

    // select all records
    await click(target.querySelector("thead .o_list_record_selector input"));
    expect(".o_list_record_selector input:checked").toHaveCount(5);
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    // unselect first record (will unselect the thead checkbox as well)
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_list_record_selector input:checked").toHaveCount(3);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    // add a domain and select first two records (need to unselect records first)
    await click(target.querySelector("thead .o_list_record_selector input")); // select all
    await click(target.querySelector("thead .o_list_record_selector input")); // unselect all
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");
    expect(".o_data_row").toHaveCount(3);
    expect(".o_list_record_selector input:checked").toHaveCount(0);

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    expect(".o_list_record_selector input:checked").toHaveCount(2);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    assert.verifySteps(['{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2,3,4],"active_model":"foo","active_domain":[]}}', '{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":2,"active_ids":[2,3,4],"active_model":"foo","active_domain":[]}}', '{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2],"active_model":"foo","active_domain":[["bar","=",true]]}}']);
});

test("execute ActionMenus actions with correct params (multi pages)", async () => {
    patchWithCleanup(actionService, {
        start() {
            const result = super.start(...arguments);
            return {
                ...result,
                doAction(id, { additionalContext }) {
                    assert.step(JSON.stringify({ action_id: id, context: additionalContext }));
                },
            };
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        info: {
            actionMenus: {
                action: [
                    {
                        id: 44,
                        name: "Custom Action",
                        type: "ir.actions.server",
                    },
                ],
                print: [],
            },
        },
        actionMenus: {},
        searchViewArch: `
                <search>
                    <filter name="bar" domain="[('bar', '=', true)]"/>
                </search>`,
    });

    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);
    expect(".o_data_row").toHaveCount(2);

    // select all records
    await contains("thead .o_list_record_selector input").click();
    expect(".o_list_record_selector input:checked").toHaveCount(3);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(1);
    expect("div.o_control_panel .o_cp_action_menus").toHaveCount(1);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    // select all domain
    await contains(".o_list_selection_box .o_list_select_domain").click();
    expect(".o_list_record_selector input:checked").toHaveCount(3);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    // add a domain (need to unselect records first)
    await click(target.querySelector("thead .o_list_record_selector input"));
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);

    // select all domain
    await contains("thead .o_list_record_selector input").click();
    await contains(".o_list_selection_box .o_list_select_domain").click();
    expect(".o_list_record_selector input:checked").toHaveCount(3);
    expect(".o_list_selection_box .o_list_select_domain").toHaveCount(0);

    await toggleActionMenu(target);
    await toggleMenuItem(target, "Custom Action");

    assert.verifySteps(['{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2],"active_model":"foo","active_domain":[]}}', '{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2,3,4],"active_model":"foo","active_domain":[]}}', '{"action_id":44,"context":{"lang":"en","tz":"taht","uid":7,"active_id":1,"active_ids":[1,2,3],"active_model":"foo","active_domain":[["bar","=",true]]}}']);
});

test("edit list line after line deletion", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="int_field"/></tree>',
    });

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[2].querySelector(".o_data_cell"));
    assert.ok($(target).find(".o_data_row:nth(2)").is(".o_selected_row"), "third row should be in edition");

    await clickDiscard(target);
    await click($(".o_list_button_add:visible").get(0));
    assert.ok($(target).find(".o_data_row:nth(0)").is(".o_selected_row"), "first row should be in edition (creation)");

    await clickDiscard(target);
    expect(".o_selected_row").toHaveCount(0, { message: "no row should be selected" });

    await click(rows[2].querySelector(".o_data_cell"));
    assert.ok($(target).find(".o_data_row:nth(2)").is(".o_selected_row"), "third row should be in edition");
    expect(".o_selected_row").toHaveCount(1, { message: "no other row should be selected" });
});

test("pressing TAB in editable list with several fields [REQUIRE FOCUS]", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field"/>
                </tree>`,
    });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row .o_data_cell input"));

    // Press 'Tab' -> should go to next cell (still in first row)
    triggerHotkey("Tab");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row .o_data_cell:nth-child(3) input"));

    // Press 'Tab' -> should go to next line (first cell)
    triggerHotkey("Tab");
    await nextTick();

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) .o_data_cell input"));
});

test("pressing SHIFT-TAB in editable list with several fields [REQUIRE FOCUS]", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field"/>
                </tree>`,
    });

    await click(target.querySelector(".o_data_row:nth-child(2) .o_data_cell"));
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) .o_data_cell input"));

    triggerHotkey("shift+Tab");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row .o_data_cell:nth-child(3) input"));

    triggerHotkey("shift+Tab");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row .o_data_cell input"));
});

test("navigation with tab and readonly field (no modification)", async () => {
    // This test makes sure that if we have 2 cells in a row, the first in
    // edit mode, and the second one readonly, then if we press TAB when the
    // focus is on the first, then the focus skip the readonly cells and
    // directly goes to the next line instead.
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field" readonly="1"/>
            </tree>`,
    });

    // Pass the first row in edition.
    await contains(".o_data_row:nth-child(1) [name=foo]").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(1)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(1) [name=foo] input"));

    // Pressing Tab should skip the readonly field and directly go to the next row.
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));

    // We do it again.
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(3)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(3) [name=foo] input"));
});

test("navigation with tab and readonly field (with modification)", async () => {
    // This test makes sure that if we have 2 cells in a row, the first in
    // edit mode, and the second one readonly, then if we press TAB when the
    // focus is on the first, then the focus skips the readonly cells and
    // directly goes to the next line instead.
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field" readonly="1"/>
                </tree>`,
    });

    // Pass the first row in edition.
    await contains(".o_data_row:nth-child(1) [name=foo]").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(1)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(1) [name=foo] input"));

    // Modity the cell content
    await editInput(document.activeElement, null, "blip-changed");

    // Pressing Tab should skip the readonly field and directly go to the next row.
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));

    // We do it again.
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(3)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(3) [name=foo] input"));
});

test('navigation with tab on a list with create="0"', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" create="0">
                <field name="display_name"/>
            </tree>`,
    });

    expect(".o_data_row").toHaveCount(4, { message: "the list should contain 4 rows" });

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[2].querySelector(".o_data_cell"));
    expect(".o_data_row:nth(2)").toHaveClass("o_selected_row", { message: "third row should be in edition" });

    // Press 'Tab' -> should go to next line
    // add a value in the cell because the Tab on an empty first cell would activate the next widget in the view
    await editInput(target, ".o_selected_row .o_data_cell input", 11);
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(3)").toHaveClass("o_selected_row", { message: "fourth row should be in edition" });

    // Press 'Tab' -> should go back to first line as the create action isn't available
    await editInput(target, ".o_selected_row .o_data_cell input", 11);
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:first").toHaveClass("o_selected_row", { message: "first row should be in edition" });
});

test('navigation with tab on a one2many list with create="0"', async () => {
    serverData.models.foo.records[0].o2m = [1, 2];
    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
            <form>
                <sheet>
                    <field name="o2m">
                    <tree editable="bottom" create="0">
                        <field name="display_name"/>
                    </tree>
                    </field>
                    <field name="foo"/>
                </sheet>
            </form>`,
        resId: 1,
        mode: "edit",
    });

    expect(".o_field_widget[name=o2m] .o_data_row").toHaveCount(2);

    await contains(".o_field_widget[name=o2m] .o_data_row:nth-child(1) .o_data_cell[name=display_name]").click();
    expect(".o_field_widget[name=o2m] .o_data_row:nth-child(1)").toHaveClass("o_selected_row");
    expect(".o_selected_row").toHaveCount(1);
    expect(document.activeElement).toBe(target.querySelector(".o_selected_row [name=display_name] input"));

    // Press 'Tab' -> should go to next line
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_field_widget[name=o2m] .o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(".o_selected_row").toHaveCount(1);
    expect(document.activeElement).toBe(target.querySelector(".o_selected_row [name=display_name] input"));

    // Pressing 'Tab' -> should use default behavior and thus get out of
    // the one to many and go to the next field of the form
    const nextInput = target.querySelector("[name=foo] input");
    const event = triggerEvent(document.activeElement, null, "keydown", { key: "Tab" }, { sync: true });
    expect(getNextTabableElement(target)).toBe(nextInput);
    assert.ok(!event.defaultPrevented);
    nextInput.focus();
    await nextTick();
    expect(document.activeElement).toBe(nextInput);
});

test("edition, then navigation with tab (with a readonly field)", async () => {
    // This test makes sure that if we have 2 cells in a row, the first in
    // edit mode, and the second one readonly, then if we edit and press TAB,
    // (before debounce), the save operation is properly done (before
    // selecting the next row)

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field" readonly="1"/>
                </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
    });

    // click on first dataRow and press TAB
    await click(target.querySelector(".o_data_row .o_data_cell"));
    await contains(".o_selected_row [name='foo'] input").edit("new value");
    triggerHotkey("Tab");
    await nextTick();

    expect("tbody tr:first td:contains(new value)").toHaveCount(1, { message: "should have the new value visible in dom" });
    expect(["get_views", "web_search_read", "web_save"]).toVerifySteps();
});

test("edition, then navigation with tab (with a readonly field and onchange)", async () => {
    // This test makes sure that if we have a read-only cell in a row, in
    // case the keyboard navigation move over it and there a unsaved changes
    // (which will trigger an onchange), the focus of the next activable
    // field will not crash
    serverData.models.bar.onchanges = {
        o2m: function () {},
    };
    serverData.models.bar.fields.o2m = {
        string: "O2M field",
        type: "one2many",
        relation: "foo",
    };
    serverData.models.bar.records[0].o2m = [1, 4];

    await mountView({
        type: "form",
        resModel: "bar",
        resId: 1,
        arch: `
                <form>
                    <group>
                        <field name="display_name"/>
                        <field name="o2m">
                            <tree editable="bottom">
                                <field name="foo"/>
                                <field name="date" readonly="1"/>
                                <field name="int_field"/>
                            </tree>
                        </field>
                    </group>
                </form>`,
        mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.step(`onchange:${args.model}`);
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    expect(document.activeElement).toBe(target.querySelector(".o_data_cell[name=foo] input"));
    await contains(".o_data_cell[name=foo] input").edit("new value");

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector(".o_data_cell[name=int_field] input"));

    expect(["onchange:bar"]).toVerifySteps();
});

test("pressing SHIFT-TAB in editable list with a readonly field [REQUIRE FOCUS]", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field" readonly="1"/>
                    <field name="qux"/>
                </tree>`,
    });

    await click(target.querySelector(".o_data_row:nth-child(2) [name=qux]"));

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=qux] input"));

    await triggerHotkey("shift+Tab");
    await nextTick();

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));
});

test("pressing SHIFT-TAB in editable list with a readonly field in first column [REQUIRE FOCUS]", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="int_field" readonly="1"/>
                    <field name="foo"/>
                    <field name="qux"/>
                </tree>`,
    });

    await click(target.querySelector(".o_data_row:nth-child(2) .o_data_cell"));

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));

    triggerHotkey("shift+Tab");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row [name=qux] input"));
});

test("pressing SHIFT-TAB in editable list with a readonly field in last column [REQUIRE FOCUS]", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="int_field"/>
                    <field name="foo"/>
                    <field name="qux" readonly="1"/>
                </tree>`,
    });

    await click(target.querySelector(".o_data_row:nth-child(2) .o_data_cell"));

    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=int_field] input"));

    triggerHotkey("shift+Tab");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row [name=foo] input"));
});

test("skip invisible fields when navigating list view with TAB", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="bar" column_invisible="1"/>
                    <field name="int_field"/>
                </tree>`,
        resId: 1,
    });

    await contains(".o_data_row:nth-child(1) .o_field_cell[name=foo]").click();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(1) .o_field_cell[name=foo] input"));
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(1) .o_field_cell[name=int_field] input"));
});

test("skip buttons when navigating list view with TAB (end)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <button name="kikou" string="Kikou" type="object"/>
                </tree>`,
        resId: 1,
    });

    await contains(".o_data_row:nth-child(3) [name=foo]").click();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(3) [name=foo] input"));
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(4) [name=foo] input"));
});

test("skip buttons when navigating list view with TAB (middle)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <button name="kikou" string="Kikou" type="object"/>
                    <field name="foo"/>
                    <button name="kikou" string="Kikou" type="object"/>
                    <field name="int_field"/>
                </tree>`,
        resId: 1,
    });

    await contains(".o_data_row:nth-child(3) [name=foo]").click();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(3) [name=foo] input"));
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(3) [name=int_field] input"));
});

test("navigation: not moving down with keydown", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/></tree>',
    });

    await click(target.querySelector(".o_field_cell[name=foo]"));
    expect(".o_data_row").toHaveClass("o_selected_row");
    triggerHotkey("arrowdown");
    await nextTick();
    expect(".o_data_row").toHaveClass("o_selected_row");
});

test("navigation: moving right with keydown from text field does not move the focus", async () => {
    serverData.models.foo.fields.foo.type = "text";
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="bar"/>
                </tree>`,
    });

    await click(target.querySelector(".o_field_cell[name=foo]"));

    const textarea = target.querySelector(".o_field_widget[name=foo] textarea");
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(3);
    textarea.selectionStart = 3; // Simulate browser keyboard right behavior (unselect)

    expect(document.activeElement).toBe(textarea);
    assert.ok(textarea.selectionStart === 3 && textarea.selectionEnd === 3);

    triggerHotkey("arrowright");
    await nextTick();

    expect(document.activeElement).toBe(textarea);
});

test("discarding changes in a row properly updates the rendering", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
    });

    expect(target.querySelector(".o_field_cell").innerText).toBe("yop", { message: "first cell should contain 'yop'" });

    await click(target.querySelector(".o_field_cell"));
    await contains(".o_field_widget[name=foo] input").edit("hello");
    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));
    expect(".modal").toHaveCount(0, { message: "should be no modal to ask for discard" });

    expect(target.querySelector(".o_field_cell").innerText).toBe("yop", { message: "first cell should still contain 'yop'" });
});

test("numbers in list are right-aligned", async () => {
    const currencies = {};
    serverData.models.res_currency.records.forEach((currency) => {
        currencies[currency.id] = currency;
    });
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="qux"/>
                <field name="amount" widget="monetary"/>
                <field name="currency_id" column_invisible="1"/>
            </tree>`,
    });
    patchWithCleanup(session, { currencies });
    const nbCellRight = [...target.querySelectorAll(".o_data_row:first-child > .o_data_cell")].filter((el) => window.getComputedStyle(el).textAlign === "right").length;
    expect(nbCellRight).toBe(2, { message: "there should be two right-aligned cells" });

    await click(target.querySelector(".o_data_cell"));
    const nbInputRight = [...target.querySelectorAll(".o_data_row:first-child > .o_data_cell input")].filter((el) => window.getComputedStyle(el).textAlign === "right").length;
    expect(nbInputRight).toBe(2, { message: "there should be two right-aligned input" });
});

test("grouped list with another grouped list parent, click unfold", async () => {
    serverData.models.bar.fields = {
        ...serverData.models.bar.fields,
        cornichon: { string: "cornichon", type: "char" },
    };

    const rec = serverData.models.bar.records[0];
    // create records to have the search more button
    const newRecs = [];
    for (let i = 0; i < 8; i++) {
        const newRec = Object.assign({}, rec);
        newRec.id = 1 + i;
        newRec.cornichon = "extra fin";
        newRecs.push(newRec);
    }
    serverData.models.bar.records = newRecs;
    serverData.views = {
        "bar,false,list": '<tree><field name="cornichon"/></tree>',
        "bar,false,search": "<search><filter context=\"{'group_by': 'cornichon'}\" string=\"cornichon\"/></search>",
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="m2o"/></tree>',
        searchViewArch: `
                <search>
                    <filter name="bar" string="bar" context="{'group_by': 'bar'}"/>
                </search>`,
    });
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");
    await toggleMenuItem(target, "bar");

    await click(target.querySelector(".o_data_cell"));
    await clickOpenM2ODropdown(target, "m2o");
    await clickOpenedDropdownItem(target, "m2o", "Search More...");
    expect(".modal-content").toHaveCount(1);
    expect(".modal-content .o_group_name").toHaveCount(0, { message: "list in modal not grouped" });

    const modal = target.querySelector(".modal");
    await toggleSearchBarMenu(modal);
    await toggleMenuItem(target, "cornichon");
    await click(target.querySelector(".o_group_header"));
    expect(".modal-content .o_group_open").toHaveCount(1);
});

test("field values are escaped", async () => {
    const value = "<script>throw Error();</script>";

    serverData.models.foo.records[0].foo = value;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
    });

    expect(target.querySelector(".o_data_cell").textContent).toBe(value, { message: "value should have been escaped" });
});

test("pressing ESC discard the current line changes", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
    });

    await click($(".o_list_button_add:visible").get(0));
    expect("tr.o_data_row").toHaveCount(5, { message: "should currently adding a 5th data row" });

    await triggerEvent(target, '[name="foo"] input', "keydown", { key: "escape" });
    expect("tr.o_data_row").toHaveCount(4, { message: "should have only 4 data row after escape" });
    expect("tr.o_data_row.o_selected_row").toHaveCount(0, { message: "no rows should be selected" });
    expect(".o_list_button_save").toHaveCount(0, { message: "should not have a save button" });
});

test("pressing ESC discard the current line changes (with required)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo" required="1"/></tree>',
    });

    await click($(".o_list_button_add:visible").get(0));
    expect("tr.o_data_row").toHaveCount(5, { message: "should currently adding a 5th data row" });

    await triggerEvent(target, '[name="foo"] input', "keydown", { key: "escape" });
    expect("tr.o_data_row").toHaveCount(4, { message: "should have only 4 data row after escape" });
    expect("tr.o_data_row.o_selected_row").toHaveCount(0, { message: "no rows should be selected" });
    expect(".o_list_button_save").toHaveCount(0, { message: "should not have a save button" });
});

test("field with password attribute", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo" password="True"/></tree>',
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row .o_data_cell")].map((el) => el.textContent),
        ["***", "****", "****", "****"]
    );
});

test("list with handle widget", async () => {
    assert.expect(11);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="int_field" widget="handle"/>
                <field name="amount" widget="float" digits="[5,0]"/>
            </tree>`,
        mockRPC(route, args) {
            if (route === "/web/dataset/resequence") {
                expect(args.offset).toBe(9, { message: "should write the sequence starting from the lowest current one" });
                expect(args.field).toBe("int_field", { message: "should write the right field as sequence" });
                expect(args.ids).toEqual([3, 2, 1], { message: "should write the sequence in correct order" });
                return Promise.resolve();
            }
        },
    });

    let rows = target.querySelectorAll(".o_data_row");
    expect(rows[0].querySelector("[name='amount']").textContent).toBe("0", { message: "default fourth record should have amount 0" });
    expect(rows[1].querySelector("[name='amount']").textContent).toBe("500", { message: "default second record should have amount 500" });
    expect(rows[2].querySelector("[name='amount']").textContent).toBe("1200", { message: "default first record should have amount 1200" });
    expect(rows[3].querySelector("[name='amount']").textContent).toBe("300", { message: "default third record should have amount 300" });

    // Drag and drop the fourth line in second position
    await contains("tbody tr:nth-child(4) .o_handle_cell").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));
    // await nextTick()
    rows = target.querySelectorAll(".o_data_row");
    expect(rows[0].querySelector("[name='amount']").textContent).toBe("0", { message: "new second record should have amount 0" });
    expect(rows[1].querySelector("[name='amount']").textContent).toBe("300", { message: "new fourth record should have amount 300" });
    expect(rows[2].querySelector("[name='amount']").textContent).toBe("500", { message: "new third record should have amount 500" });
    expect(rows[3].querySelector("[name='amount']").textContent).toBe("1200", { message: "new first record should have amount 1200" });
});

test("result of consecutive resequences is correctly sorted", async () => {
    assert.expect(9);
    serverData.models = {
        // we want the data to be minimal to have a minimal test
        foo: {
            fields: { int_field: { string: "int_field", type: "integer", sortable: true } },
            records: [
                { id: 1, int_field: 11 },
                { id: 2, int_field: 12 },
                { id: 3, int_field: 13 },
                { id: 4, int_field: 14 },
            ],
        },
    };
    let moves = 0;
    const context = {
        lang: "en",
        tz: "taht",
        uid: 7,
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="int_field" widget="handle"/>
                <field name="id"/>
            </tree>`,
        mockRPC(route, args) {
            if (route === "/web/dataset/resequence") {
                if (moves === 0) {
                    assert.deepEqual(args, {
                        context,
                        model: "foo",
                        ids: [4, 3],
                        offset: 13,
                        field: "int_field",
                    });
                }
                if (moves === 1) {
                    assert.deepEqual(args, {
                        context,
                        model: "foo",
                        ids: [4, 2],
                        offset: 12,
                        field: "int_field",
                    });
                }
                if (moves === 2) {
                    assert.deepEqual(args, {
                        context,
                        model: "foo",
                        ids: [2, 4],
                        offset: 12,
                        field: "int_field",
                    });
                }
                if (moves === 3) {
                    assert.deepEqual(args, {
                        context,
                        model: "foo",
                        ids: [4, 2],
                        offset: 12,
                        field: "int_field",
                    });
                }
                moves += 1;
            }
        },
    });
    expect($(target).find("tbody tr td.o_list_number").text()).toBe("1234", { message: "default should be sorted by id" });

    await contains(".o_list_view tbody tr:nth-child(4) .o_handle_cell").dragAndDrop(queryFirst(".o_list_view tbody tr:nth-child(3)"));
    expect($(target).find("tbody tr td.o_list_number").text()).toBe("1243", { message: "the int_field (sequence) should have been correctly updated" });

    await contains(".o_list_view tbody tr:nth-child(3) .o_handle_cell").dragAndDrop(queryFirst(".o_list_view tbody tr:nth-child(2)"));
    expect($(target).find("tbody tr td.o_list_number").text()).toEqual("1423", { message: "the int_field (sequence) should have been correctly updated" });

    await dragAndDrop(".o_list_view tbody tr:nth-child(2) .o_handle_cell", ".o_list_view tbody tr:nth-child(3)", "top");
    expect($(target).find("tbody tr td.o_list_number").text()).toEqual("1243", { message: "the int_field (sequence) should have been correctly updated" });

    await dragAndDrop(".o_list_view tbody tr:nth-child(3) .o_handle_cell", ".o_list_view tbody tr:nth-child(2)", "top");
    expect($(target).find("tbody tr td.o_list_number").text()).toEqual("1423", { message: "the int_field (sequence) should have been correctly updated" });
});

test("editable list with handle widget", async () => {
    assert.expect(12);

    // resequence makes sense on a sequence field, not on arbitrary fields
    serverData.models.foo.records[0].int_field = 0;
    serverData.models.foo.records[1].int_field = 1;
    serverData.models.foo.records[2].int_field = 2;
    serverData.models.foo.records[3].int_field = 3;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" default_order="int_field">
                <field name="int_field" widget="handle"/>
                <field name="amount" widget="float" digits="[5,0]"/>
            </tree>`,
        mockRPC(route, args) {
            if (route === "/web/dataset/resequence") {
                expect(args.offset).toBe(1, { message: "should write the sequence starting from the lowest current one" });
                expect(args.field).toBe("int_field", { message: "should write the right field as sequence" });
                expect(args.ids).toEqual([4, 2, 3], { message: "should write the sequence in correct order" });
            }
        },
    });

    expect($(target).find("tbody tr:eq(0) td:last").text()).toBe("1200", { message: "default first record should have amount 1200" });
    expect($(target).find("tbody tr:eq(1) td:last").text()).toBe("500", { message: "default second record should have amount 500" });
    expect($(target).find("tbody tr:eq(2) td:last").text()).toBe("300", { message: "default third record should have amount 300" });
    expect($(target).find("tbody tr:eq(3) td:last").text()).toBe("0", { message: "default fourth record should have amount 0" });

    // Drag and drop the fourth line in second position
    await contains("tbody tr:nth-child(4) .o_handle_cell").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));

    expect($(target).find("tbody tr:eq(0) td:last").text()).toBe("1200", { message: "new first record should have amount 1200" });
    expect($(target).find("tbody tr:eq(1) td:last").text()).toBe("0", { message: "new second record should have amount 0" });
    expect($(target).find("tbody tr:eq(2) td:last").text()).toBe("500", { message: "new third record should have amount 500" });
    expect($(target).find("tbody tr:eq(3) td:last").text()).toBe("300", { message: "new fourth record should have amount 300" });

    await contains("tbody tr:nth-child(2) div[name='amount']").click();

    expect($(target).find("tbody tr:eq(1) td:last input").val()).toBe("0", { message: "the edited record should be the good one" });
});

test("editable target, handle widget locks and unlocks on sort", async () => {
    // we need another sortable field to lock/unlock the handle
    serverData.models.foo.fields.amount.sortable = true;
    // resequence makes sense on a sequence field, not on arbitrary fields
    serverData.models.foo.records[0].int_field = 0;
    serverData.models.foo.records[1].int_field = 1;
    serverData.models.foo.records[2].int_field = 2;
    serverData.models.foo.records[3].int_field = 3;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" default_order="int_field">
                <field name="int_field" widget="handle"/>
                <field name="amount" widget="float"/>
            </tree>`,
    });

    expect($(target).find('tbody div[name="amount"]').text()).toBe("1200.00500.00300.000.00", { message: "default should be sorted by int_field" });

    // Drag and drop the fourth line in second position
    await contains("tbody tr:nth-child(4) .o_row_handle").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));

    // Handle should be unlocked at this point
    expect($(target).find('tbody div[name="amount"]').text()).toBe("1200.000.00500.00300.00", { message: "drag and drop should have succeeded, as the handle is unlocked" });

    // Sorting by a field different for int_field should lock the handle
    await click(target.querySelectorAll(".o_column_sortable")[1]);
    expect($(target).find('tbody div[name="amount"]').text()).toBe("0.00300.00500.001200.00", { message: "should have been sorted by amount" });

    // Drag and drop the fourth line in second position (not)
    await contains("tbody tr:nth-child(4) .o_row_handle").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));
    expect($(target).find('tbody div[name="amount"]').text()).toBe("0.00300.00500.001200.00", { message: "drag and drop should have failed as the handle is locked" });

    // Sorting by int_field should unlock the handle
    await click(queryFirst(".o_column_sortable"));
    expect($(target).find('tbody div[name="amount"]').text()).toBe("1200.000.00500.00300.00", { message: "records should be ordered as per the previous resequence" });

    // Drag and drop the fourth line in second position
    await contains("tbody tr:nth-child(4) .o_row_handle").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));
    expect($(target).find('tbody div[name="amount"]').text()).toBe("1200.00300.000.00500.00", { message: "drag and drop should have worked as the handle is unlocked" });
});

test("editable list with handle widget with slow network", async () => {
    assert.expect(15);

    // resequence makes sense on a sequence field, not on arbitrary fields
    serverData.models.foo.records[0].int_field = 0;
    serverData.models.foo.records[1].int_field = 1;
    serverData.models.foo.records[2].int_field = 2;
    serverData.models.foo.records[3].int_field = 3;

    const prom = makeDeferred();

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="int_field" widget="handle" />
                <field name="amount" widget="float" digits="[5,0]" />
            </tree>`,
        mockRPC: async function (route, { field, ids, offset }) {
            if (route === "/web/dataset/resequence") {
                expect(offset).toBe(1, { message: "should write the sequence starting from the lowest current one" });
                expect(field).toBe("int_field", { message: "should write the right field as sequence" });
                expect(ids).toEqual([4, 2, 3], { message: "should write the sequence in correct order" });
                await prom;
            }
        },
    });
    expect(target.querySelector("tbody tr:nth-child(1) td:nth-child(3)").textContent).toBe("1200", { message: "default first record should have amount 1200" });
    expect(target.querySelector("tbody tr:nth-child(2) td:nth-child(3)").textContent).toBe("500", { message: "default second record should have amount 500" });
    expect(target.querySelector("tbody tr:nth-child(3) td:nth-child(3)").textContent).toBe("300", { message: "default third record should have amount 300" });
    expect(target.querySelector("tbody tr:nth-child(4) td:nth-child(3)").textContent).toBe("0", { message: "default fourth record should have amount 0" });
    // drag and drop the fourth line in second position
    await contains("tbody tr:nth-child(4) .o_handle_cell").dragAndDrop(queryFirst("tbody tr:nth-child(2)"));

    // edit moved row before the end of resequence
    await contains("tbody tr:nth-child(4) .o_field_widget[name='amount']").click();
    await nextTick();

    expect("tbody tr:nth-child(4) td:nth-child(3) input").toHaveCount(0, { message: "shouldn't edit the line before resequence" });

    prom.resolve();
    await nextTick();

    expect("tbody tr:nth-child(4) td:nth-child(3) input").toHaveCount(1, { message: "should edit the line after resequence" });

    expect(target.querySelector("tbody tr:nth-child(4) td:nth-child(3) input").value).toBe("300", { message: "fourth record should have amount 300" });

    await editInput(target, ".o_data_row [name='amount'] input", 301);
    await contains("tbody tr:nth-child(1) .o_field_widget[name='amount']").click();
    await clickSave(target);

    expect(target.querySelector("tbody tr:nth-child(1) td:nth-child(3)").textContent).toBe("1200", { message: "first record should have amount 1200" });
    expect(target.querySelector("tbody tr:nth-child(2) td:nth-child(3)").textContent).toBe("0", { message: "second record should have amount 1" });
    expect(target.querySelector("tbody tr:nth-child(3) td:nth-child(3)").textContent).toBe("500", { message: "third record should have amount 500" });
    expect(target.querySelector("tbody tr:nth-child(4) td:nth-child(3)").textContent).toBe("301", { message: "fourth record should have amount 301" });

    await contains("tbody tr:nth-child(4) .o_field_widget[name='amount']").click();

    expect(target.querySelector("tbody tr:nth-child(4) td:nth-child(3) input").value).toBe("301", { message: "fourth record should have amount 301" });
});

test("multiple clicks on Add do not create invalid rows", async () => {
    serverData.models.foo.onchanges = {
        m2o: function () {},
    };

    const prom = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="m2o" required="1"/></tree>',
        mockRPC: async function (route, args, performRPC) {
            const result = await performRPC(route, args);
            if (args.method === "onchange") {
                await prom;
            }
            return result;
        },
    });

    expect(".o_data_row").toHaveCount(4, { message: "should contain 4 records" });

    // click on Add and delay the onchange (check that the button is correctly disabled)
    click($(".o_list_button_add:visible").get(0));
    assert.ok($(".o_list_button_add:visible").get(0).disabled);

    prom.resolve();
    await nextTick();

    expect(".o_data_row").toHaveCount(5, { message: "only one record should have been created" });
});

test("reference field rendering", async () => {
    serverData.models.foo.records.push({
        id: 5,
        reference: "res_currency,2",
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="reference"/></tree>',
    });

    expect($(target).find("tbody td:not(.o_list_record_selector)").text()).toBe("Value 1USDEUREUR", { message: "should have the display_name of the reference" });
});

test("reference field batched in grouped list", async () => {
    assert.expect(7);

    serverData.models.foo.records = [
        // group 1
        { id: 1, foo: "1", reference: "bar,1" },
        { id: 2, foo: "1", reference: "bar,2" },
        { id: 3, foo: "1", reference: "res_currency,1" },
        //group 2
        { id: 4, foo: "2", reference: "bar,2" },
        { id: 5, foo: "2", reference: "bar,3" },
    ];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1">
                <field name="foo" column_invisible="1"/>
                <field name="reference"/>
            </tree>`,
        groupBy: ["foo"],
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
    });
    expect(["get_views", "web_read_group", "web_search_read", "web_search_read"]).toVerifySteps();
    expect(".o_group_header").toHaveCount(2);
    const allNames = Array.from(target.querySelectorAll(".o_data_cell"), (node) => node.textContent);
    expect(allNames).toEqual(["Value 1", "Value 2", "USD", "Value 2", "Value 3"]);
});

test("multi edit in view grouped by field not in view", async () => {
    serverData.models.foo.records = [
        // group 1
        { id: 1, foo: "1", m2o: 1 },
        { id: 3, foo: "2", m2o: 1 },
        //group 2
        { id: 2, foo: "1", m2o: 2 },
        { id: 4, foo: "2", m2o: 2 },
        // group 3
        { id: 5, foo: "2", m2o: 3 },
    ];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1" multi_edit="1">
                <field name="foo"/>
            </tree>`,
        groupBy: ["m2o"],
    });
    // Select items from the first group
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(target.querySelector(".o_list_char"));
    await contains(".o_data_row [name=foo] input").edit("test");
    expect(".modal").toHaveCount(1);

    await contains(".modal .modal-footer .btn-primary").click();
    expect(".modal").toHaveCount(0);
    const allNames = [...document.querySelectorAll(".o_data_cell")].map((n) => n.textContent);
    expect(allNames).toEqual(["test", "test", "1", "2", "2"]);
});

test("multi edit reference field batched in grouped list", async () => {
    assert.expect(13);

    serverData.models.foo.records = [
        // group 1
        { id: 1, foo: "1", reference: "bar,1" },
        { id: 2, foo: "1", reference: "bar,2" },
        //group 2
        { id: 3, foo: "2", reference: "res_currency,1" },
        { id: 4, foo: "2", reference: "bar,2" },
        { id: 5, foo: "2", reference: "bar,3" },
    ];
    // Field boolean_toggle just to simplify the test flow
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree expand="1" multi_edit="1">
                <field name="foo" column_invisible="1"/>
                <field name="bar" widget="boolean_toggle"/>
                <field name="reference"/>
            </tree>`,
        groupBy: ["foo"],
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2, 3], { bar: true }]);
            }
        },
    });

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read"]).toVerifySteps();
    await click(queryFirst(".o_data_row .o_list_record_selector input"));
    await click(target.querySelectorAll(".o_data_row .o_list_record_selector input")[1]);
    await click(target.querySelectorAll(".o_data_row .o_list_record_selector input")[2]);
    await click(target.querySelector(".o_data_row .o_field_boolean input"));
    expect(".modal").toHaveCount(1);

    await contains(".modal .modal-footer .btn-primary").click();
    expect(".modal").toHaveCount(0);
    expect(["write", "web_read"]).toVerifySteps();
    expect(".o_group_header").toHaveCount(2);

    const allNames = Array.from(target.querySelectorAll(".o_data_cell"))
        .filter((node) => !node.children.length)
        .map((n) => n.textContent);
    expect(allNames).toEqual(["Value 1", "Value 2", "USD", "Value 2", "Value 3"]);
});

test("multi edit field with daterange widget", async () => {
    assert.expect(5);

    serverData.models.daterange = {
        fields: {
            date_start: { string: "Date Start", type: "date" },
            date_end: { string: "Date End", type: "date" },
        },
        records: [
            {
                id: 1,
                date_start: "2017-01-25",
                date_end: "2017-01-26",
            },
            {
                id: 2,
                date_start: "2017-01-02",
                date_end: "2017-01-03",
            },
        ],
    };
    patchTimeZone(360);

    await mountView({
        type: "list",
        resModel: "daterange",
        arch: `
            <tree multi_edit="1">
                <field name="date_start" widget="daterange" options="{'end_date_field': 'date_end'}" />
            </tree>`,
        mockRPC(route, args) {
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2], { date_start: "2017-01-16", date_end: "2017-02-12" }]);
            }
        },
    });
    await click(target.querySelector(".o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_data_cell")); // edit first row
    await click(target.querySelector(".o_data_row .o_data_cell .o_field_daterange input"));

    // change dates range
    await click(getPickerCell("16").at(0));
    await click(getPickerCell("12").at(1));
    assert.notOk(getPickerApplyButton().disabled);

    // Apply the changes
    await click(getPickerApplyButton());
    expect(".modal").toHaveCount(1, { message: "The confirm dialog should appear to confirm the multi edition." });

    const changesTable = document.querySelector(".modal-body .o_modal_changes");
    expect(changesTable.innerText.replaceAll("\n").toBe("").replaceAll("\t", ""), { message: "Field:Date StartUpdate to:01/16/201702/12/2017Field:Date EndUpdate to:02/12/2017" });

    // Valid the confirm dialog
    await contains(".modal .btn-primary").click();
    expect(".modal").toHaveCount(0);
});

test("multi edit field with daterange widget (edition without using the picker)", async () => {
    assert.expect(4);

    serverData.models.daterange = {
        fields: {
            date_start: { string: "Date Start", type: "date" },
            date_end: { string: "Date End", type: "date" },
        },
        records: [
            {
                id: 1,
                date_start: "2017-01-25",
                date_end: "2017-01-26",
            },
            {
                id: 2,
                date_start: "2017-01-02",
                date_end: "2017-01-03",
            },
        ],
    };
    patchTimeZone(360);

    await mountView({
        type: "list",
        resModel: "daterange",
        arch: `
                <tree multi_edit="1">
                    <field name="date_start" widget="daterange" options="{'end_date_field': 'date_end'}" />
                </tree>`,
        mockRPC(route, args) {
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2], { date_start: "2021-04-01", date_end: "2017-01-26" }]);
            }
        },
    });

    // Test manually edit the date without using the daterange picker
    await click(target.querySelector(".o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_data_cell")); // edit first row

    // Change the date in the first datetime
    await contains(".o_data_row .o_data_cell .o_field_daterange[name='date_start'] input[data-field='date_start']").edit("2021-04-01 11:00:00");
    triggerHotkey("Enter");
    await nextTick();
    expect(".modal").toHaveCount(1, { message: "The confirm dialog should appear to confirm the multi edition." });

    const changesTable = target.querySelector(".modal-body .o_modal_changes");
    expect(changesTable.innerText.replaceAll("\n").toBe("").replaceAll("\t", ""), { message: "Field:Date StartUpdate to:04/01/202101/26/2017Field:Date EndUpdate to:01/26/2017" });

    // Valid the confirm dialog
    await contains(".modal .btn-primary").click();
    expect(".modal").toHaveCount(0);
});

test("list daterange with start date and empty end date", async () => {
    serverData.models.foo.fields.date_end = { string: "Some Date", type: "date" };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: /* xml */ `
            <tree>
                <field name="date" widget="daterange" options="{'end_date_field': 'date_end'}" />
            </tree>`,
    });

    const arrowIcon = target.querySelector(".fa-long-arrow-right");
    const textSiblings = [...arrowIcon.parentNode.childNodes]
        .map((node) => {
            if (node === arrowIcon) {
                return "->";
            } else if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue.trim();
            } else {
                return node.innerText?.trim();
            }
        })
        .filter(Boolean);

    expect(textSiblings).toEqual(["01/25/2017", "->"]);
});

test("list daterange with start date and empty end date (2)", async () => {
    serverData.models.foo.fields.date_end = { string: "Some Date", type: "date" };
    const [firstRecord] = serverData.models.foo.records;
    [firstRecord.date, firstRecord.date_end] = [firstRecord.date_end, firstRecord.date];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: /* xml */ `
            <tree>
                <field name="date" widget="daterange" options="{'end_date_field': 'date_end'}" />
            </tree>`,
    });

    const arrowIcon = target.querySelector(".fa-long-arrow-right");
    const textSiblings = [...arrowIcon.parentNode.childNodes]
        .map((node) => {
            if (node === arrowIcon) {
                return "->";
            } else if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue.trim();
            } else {
                return node.innerText?.trim();
            }
        })
        .filter(Boolean);

    expect(textSiblings).toEqual(["->", "01/25/2017"]);
});

test("editable list view: contexts are correctly sent", async () => {
    assert.expect(4);

    patchUserContextWithCleanup({ someKey: "some value" });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (args.method !== "get_views") {
                const context = args.kwargs.context;
                expect(context.active_field).toBe(2, { message: "context should be correct" });
                expect(context.someKey).toBe("some value", { message: "context should be correct" });
            }
        },
        context: { active_field: 2 },
    });

    await click(target.querySelector(".o_data_cell"));
    await editInput(target.querySelector(".o_field_widget[name=foo] input"), null, "abc");
    await click($(".o_list_button_save:visible").get(0));
});

test("editable list view: contexts with multiple edit", async () => {
    assert.expect(4);

    patchUserContextWithCleanup({ someKey: "some value" });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree multi_edit="1"><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (route === "/web/dataset/call_kw/foo/write" || route === "/web/dataset/call_kw/foo/web_read") {
                const context = args.kwargs.context;
                expect(context.active_field).toBe(2, { message: "context should be correct" });
                expect(context.someKey).toBe("some value", { message: "context should be correct" });
            }
        },
        context: { active_field: 2 },
    });

    // Uses the main selector to select all lines.
    await click(target.querySelector(".o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_data_cell"));

    // Edits first record then confirms changes.
    await contains(".o_data_row [name=foo] input").edit("legion");
    await contains(".modal-dialog button.btn-primary").click();
});

test("editable list view: single edition with selected records", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="top" multi_edit="1"><field name="foo"/></tree>`,
    });

    // Select first record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));

    // Edit the second
    await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
    await contains(".o_data_cell input").edit("oui");
    await click($(".o_list_button_save:visible").get(0));

    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell"))).toEqual(["yop", "oui", "gnap", "blip"]);
});

test("editable list view: non dirty record with required fields", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo" required="1"/>
                    <field name="int_field"/>
                </tree>`,
    });
    expect(".o_data_row").toHaveCount(4);

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(1);

    // do not change anything and then click outside should discard record
    await contains(".o_list_view").click();
    expect(".o_data_row").toHaveCount(4);
    expect(".o_selected_row").toHaveCount(0);

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(1);

    // do not change anything and then click save button should not allow to discard record
    await click($(".o_list_button_save:visible").get(0));
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(1);

    // selecting some other row should discard non dirty record
    await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveCount(4);
    expect(".o_selected_row").toHaveCount(1);

    // click somewhere else to discard currently selected row
    await contains(".o_list_view").click();
    expect(".o_data_row").toHaveCount(4);
    expect(".o_selected_row").toHaveCount(0);

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(1);

    // do not change anything and press Enter key should not allow to discard record
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);

    // discard row and create new record and keep required field empty and click anywhere
    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));
    await click($(".o_list_button_add:visible").get(0));
    expect(".o_selected_row").toHaveCount(1, { message: "row should be selected" });
    await editInput(target, ".o_selected_row [name=int_field] input", 123);
    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(1, { message: "row should still be in edition" });
});

test("editable list view: multi edition", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2], { int_field: 666 }], { message: "should write on multi records" });
            } else if (args.method === "web_read") {
                if (args.args[0].length !== 1) {
                    expect(args.args).toEqual([[1, 2]], { message: "should batch the read" });
                    expect(args.kwargs.specification).toEqual({ foo: {}, int_field: {} });
                }
            }
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit a line without modifying a field
    await click(rows[0].querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");

    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(0);

    // create a record and edit its value
    await click($(".o_list_button_add:visible").get(0));
    expect(["onchange"]).toVerifySteps();

    await editInput(target, ".o_selected_row [name=int_field] input", 123);
    expect(".modal").toHaveCount(0);

    await clickSave(target);
    expect(["web_save"]).toVerifySteps();

    // edit a field
    await click(rows[0].querySelector("[name=int_field]"));
    await editInput(rows[0], "[name=int_field] input", 666);
    expect(".modal").toHaveCount(1);

    await contains(".modal .btn.btn-secondary").click();
    expect(".o_list_record_selector input:checked").toHaveCount(2);
    assert.deepEqual(
        [...rows[0].querySelectorAll(".o_data_cell")].map((el) => el.innerText),
        ["yop", "10"]
    );
    expect(document.activeElement).toBe(rows[0].querySelector(".o_data_cell[name=int_field]"));

    await click(rows[0].querySelectorAll(".o_data_cell")[1]);
    await editInput(target, ".o_data_row [name=int_field] input", 666);
    assert.ok($(".modal").text().includes("those 2 records"), "the number of records should be correctly displayed");

    await contains(".modal .btn-primary").click();
    expect(".o_data_cell input.o_field_widget").toHaveCount(0, { message: "no field should be editable anymore" });
    // discard selection
    await contains(".o_list_unselect_all").click();
    expect(".o_list_record_selector input:checked").toHaveCount(0, { message: "no record should be selected anymore" });
    expect(["write", "web_read"]).toVerifySteps();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop666", { message: "the first row should be updated" });
    expect($(target).find(".o_data_row:eq(1) .o_data_cell").text()).toBe("blip666", { message: "the second row should be updated" });
    expect(".o_data_cell input.o_field_widget").toHaveCount(0, { message: "no field should be editable anymore" });
});

test("editable list view: multi edit a field with string attr", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo" string="Custom Label"/>
                <field name="int_field"/>
            </tree>`,
    });

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit foo
    await click(rows[0].querySelector(".o_data_cell"));
    await contains(".o_data_row [name=foo] input").edit("new value");

    expect(".modal").toHaveCount(1);
    const changesTable = target.querySelector(".modal-body .o_modal_changes");
    expect(changesTable.innerText.replaceAll("\n").toBe("").replaceAll("\t", ""), { message: "Field:Custom LabelUpdate to:new value" });
});

test("create in multi editable list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        createRecord: () => {
            assert.step("createRecord");
        },
    });

    // click on CREATE (should trigger a switch_view)
    await click($(".o_list_button_add:visible").get(0));
    expect(["createRecord"]).toVerifySteps();
});

test("editable list view: multi edition cannot call onchanges", async () => {
    serverData.models.foo.onchanges = {
        foo: function (obj) {
            obj.int_field = obj.foo.length;
        },
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "write") {
                args.args[1].int_field = args.args[1].foo.length;
            }
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();

    // select and edit a single record
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    await contains(".o_data_row [name=foo] input").edit("hi");
    expect(".modal").toHaveCount(0);
    assert.deepEqual(
        [...rows[0].querySelectorAll(".o_data_cell")].map((el) => el.innerText),
        ["hi", "2"]
    );
    assert.deepEqual(
        [...rows[1].querySelectorAll(".o_data_cell")].map((el) => el.innerText),
        ["blip", "9"]
    );

    expect(["write", "web_read"]).toVerifySteps();
    // select the second record (the first one is still selected)
    expect(".o_list_record_selector input:checked").toHaveCount(1, { message: "Record should be still selected" });
    await click(rows[1], ".o_list_record_selector input");

    // edit foo, first row
    await click(rows[0].querySelector(".o_data_cell"));
    await contains(".o_data_row [name=foo] input").edit("hello");
    expect(".modal").toHaveCount(1); // save dialog

    await contains(".modal .btn-primary").click();
    assert.deepEqual(
        [...rows[0].querySelectorAll(".o_data_cell")].map((el) => el.innerText),
        ["hello", "5"]
    );
    assert.deepEqual(
        [...rows[1].querySelectorAll(".o_data_cell")].map((el) => el.innerText),
        ["hello", "5"]
    );

    assert.verifySteps(["write", "web_read"], "should not perform the onchange in multi edition");
});

test("editable list view: multi edition error and cancellation handling", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree multi_edit="1">
                    <field name="foo" required="1"/>
                    <field name="int_field"/>
                </tree>`,
    });

    expect(".o_list_record_selector input:enabled").toHaveCount(5);

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit a line and cancel
    await click(rows[0].querySelector(".o_data_cell"));
    expect(".o_list_record_selector input:enabled").toHaveCount(0);
    await contains(".o_selected_row [name=foo] input").edit("abc");
    await contains(".modal .btn.btn-secondary").click();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop10", { message: "first cell should have discarded any change" });
    expect(".o_list_record_selector input:enabled").toHaveCount(5);

    // edit a line with an invalid format type
    await click(rows[0].querySelectorAll(".o_data_cell")[1]);
    expect(".o_list_record_selector input:enabled").toHaveCount(0);

    await contains(".o_selected_row [name=int_field] input").edit("hahaha");
    expect(".modal").toHaveCount(1, { message: "there should be an opened modal" });

    await contains(".modal .btn-primary").click();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop10", { message: "changes should be discarded" });
    expect(".o_list_record_selector input:enabled").toHaveCount(5);

    // edit a line with an invalid value
    await click(rows[0].querySelector(".o_data_cell"));
    expect(".o_list_record_selector input:enabled").toHaveCount(0);

    await editInput(target, ".o_selected_row [name=foo] input", "");
    expect(".modal").toHaveCount(1, { message: "there should be an opened modal" });
    await contains(".modal .btn-primary").click();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop10", { message: "changes should be discarded" });
    expect(".o_list_record_selector input:enabled").toHaveCount(5);
});

test("multi edition: many2many_tags in many2many field", async () => {
    for (let i = 4; i <= 10; i++) {
        serverData.models.bar.records.push({ id: i, display_name: "Value" + i });
    }

    serverData.views = {
        "bar,false,list": '<tree><field name="name"/></tree>',
        "bar,false,search": "<search></search>",
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree multi_edit="1"><field name="m2m" widget="many2many_tags"/></tree>',
    });

    expect(".o_list_record_selector input:enabled").toHaveCount(5);

    // select two records and enter edit mode
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    await selectDropdownItem(target, "m2m", "Search More...");
    expect(".modal").toHaveCount(1, { message: "should have open the modal" });

    await click(target.querySelector(".modal .o_data_row .o_field_cell"));
    expect(".modal [role='alert']").toHaveCount(1, { message: "should have open the confirmation modal" });
    expect(".modal .o_field_many2many_tags .badge").toHaveCount(3);
    expect(target.querySelector(".modal .o_field_many2many_tags .badge:nth-child(3)").textContent.trim()).toBe("Value 3", { message: "should have display_name in badge" });
});

test("multi edition: many2many field in grouped list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        groupBy: ["m2m"],
    });

    await click(target.querySelectorAll(".o_group_header")[1]); // open Value 1 group
    await click(target.querySelectorAll(".o_group_header")[2]); // open Value 2 group

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[0].querySelectorAll(".o_data_cell")[1]);
    await selectDropdownItem(target, "m2m", "Value 3");
    expect(rows[0].querySelectorAll(".o_data_cell")[1].textContent).toBe("Value 1Value 2Value 3", { message: "should have a right value in many2many field" });
    expect(rows[3].querySelectorAll(".o_data_cell")[1].textContent).toBe("Value 1Value 2Value 3", { message: "should have same value in many2many field on all other records with same res_id" });
});

test("editable list view: multi edition of many2one: set same value", async () => {
    assert.expect(4);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree multi_edit="1">
                    <field name="foo"/>
                    <field name="m2o"/>
                </tree>`,
        mockRPC(route, args) {
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2, 3, 4], { m2o: 2 }], { message: "should force write value on all selected records" });
            }
        },
    });

    expect($(target).find(".o_list_many2one").text()).toBe("Value 1Value 2Value 1Value 1");

    // select all records (the first one has value 1 for m2o)
    await click(target.querySelector(".o_list_record_selector input"));

    // set m2o to 1 in first record
    await click(target.querySelector(".o_data_row .o_data_cell"));
    await contains(".o_data_row [name=m2o] input").edit("Value 2");
    await click(target.querySelector(".o-autocomplete--dropdown-item"));
    expect(".modal").toHaveCount(1);

    await contains(".modal .modal-footer .btn-primary").click();
    expect($(target).find(".o_list_many2one").text()).toBe("Value 2Value 2Value 2Value 2");
});

test('editable list view: clicking on "Discard changes" in multi edition', async () => {
    await mountView({
        type: "list",
        arch: `
                <tree editable="top" multi_edit="1">
                    <field name="foo"/>
                </tree>`,
        resModel: "foo",
    });

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    target.querySelector(".o_data_row .o_data_cell input").value = "oof";

    const discardButton = $(".o_list_button_discard:visible").get(0);
    // Simulates an actual click (event chain is: mousedown > change > blur > focus > mouseup > click)
    await triggerEvents(discardButton, null, ["mousedown"]);
    await triggerEvents(target.querySelector(".o_data_row .o_data_cell input"), null, ["change", "blur", "focusout"]);
    await triggerEvents(discardButton, null, ["focus"]);
    await triggerEvents(discardButton, null, ["mouseup"]);
    await click(discardButton);

    expect(".modal").toHaveCount(0, { message: "should not open modal" });

    expect($(target).find(".o_data_row:first() .o_data_cell:first()").text()).toBe("yop");
});

test('editable list view: mousedown on "Discard", mouseup somewhere else (no multi-edit)', async () => {
    await mountView({
        type: "list",
        arch: `
                <tree editable="top">
                    <field name="foo"/>
                </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
        resModel: "foo",
    });

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    target.querySelector(".o_data_row .o_data_cell input").value = "oof";

    await triggerEvents($(".o_list_button_discard:visible").get(0), null, ["mousedown"]);
    await triggerEvents(target, ".o_data_row .o_data_cell input", ["change", "blur", "focusout"]);
    await triggerEvents(target, null, ["focus"]);
    await triggerEvents(target, null, ["mouseup"]);
    await click(target);

    expect(".modal").toHaveCount(0, { message: "should not open modal" });
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell"))).toEqual(["oof", "blip", "gnap", "blip"]);
    expect(["get_views", "web_search_read", "web_save"]).toVerifySteps();
});

test('multi edit list view: mousedown on "Discard" with invalid field', async () => {
    await mountView({
        type: "list",
        arch: `
                <tree multi_edit="1">
                    <field name="int_field"/>
                </tree>`,
        resModel: "foo",
    });

    expect(target.querySelector(".o_data_row .o_data_cell").innerText).toBe("10");

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit the numeric field with an invalid value
    await click(rows[0].querySelector(".o_data_cell"));
    target.querySelector(".o_data_row .o_data_cell input").value = "oof";
    await triggerEvents(target, ".o_data_row .o_data_cell input", ["input"]);

    // mousedown on Discard and then mouseup also on Discard
    await triggerEvents($(".o_list_button_discard:visible").get(0), null, ["mousedown"]);
    await triggerEvents(target, ".o_data_row .o_data_cell input", ["change", "blur", "focusout"]);
    await triggerEvents($(".o_list_button_discard:visible").get(0), null, ["focus"]);
    expect(".o_dialog").toHaveCount(0, { message: "should not display an invalid field dialog" });
    await triggerEvents($(".o_list_button_discard:visible").get(0), null, ["mouseup"]);
    await click(target.querySelector(".o_list_button_discard:not(.dropdown-item)"));
    expect(".o_dialog").toHaveCount(0, { message: "should not display an invalid field dialog" });
    expect(target.querySelector(".o_data_row .o_data_cell").innerText).toBe("10");

    // edit again with an invalid value
    await click(rows[0].querySelector(".o_data_cell"));
    target.querySelector(".o_data_row .o_data_cell input").value = "oof2";
    await triggerEvents(target, ".o_data_row .o_data_cell input", ["input"]);

    // mousedown on Discard (simulate a mousemove) and mouseup somewhere else
    await triggerEvents($(".o_list_button_discard:visible").get(0), null, ["mousedown"]);
    await triggerEvents(target, ".o_data_row .o_data_cell input", ["change", "blur", "focusout"]);
    await triggerEvents(target, null, ["focus"]);
    expect(".o_dialog").toHaveCount(0, { message: "should not display an invalid field dialog" });
    await triggerEvents(target, null, ["mouseup"]);
    await click(target);
    expect(".o_dialog").toHaveCount(1, { message: "should display an invalid field dialog" });
    await contains(".o_dialog .modal-footer .btn-primary").click(); // click OK
    expect(target.querySelector(".o_data_row .o_data_cell").innerText).toBe("10");
});

test('editable list view (multi edition): mousedown on "Discard", but mouseup somewhere else', async () => {
    await mountView({
        type: "list",
        arch: `
                <tree multi_edit="1">
                    <field name="foo"/>
                </tree>`,
        resModel: "foo",
    });

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_data_cell"));
    target.querySelector(".o_data_row .o_data_cell input").value = "oof";

    const discardButton = $(".o_list_button_discard:visible").get(0);
    // Simulates an actual click (event chain is: mousedown > change > blur > focus > mouseup > click)
    await triggerEvents(discardButton, null, ["mousedown"]);
    await triggerEvents(target.querySelector(".o_data_row .o_data_cell input"), null, ["change", "blur", "focusout"]);
    await triggerEvents(discardButton, null, ["focus"]);
    await triggerEvents(document.body, null, ["mouseup"]);
    await triggerEvents(document.body, null, ["click"]);

    assert.ok($(".modal").text().includes("Confirmation"), "Modal should ask to save changes");
    await contains(".modal .btn-primary").click();
});

test("editable list view (multi edition): writable fields in readonly (force save)", async () => {
    assert.expect(8);

    // boolean toogle widget allows for writing on the record even in readonly mode
    await mountView({
        type: "list",
        arch: `
                <tree multi_edit="1">
                    <field name="bar" widget="boolean_toggle"/>
                </tree>`,
        resModel: "foo",
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 3], { bar: false }]);
            }
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();
    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[2], ".o_list_record_selector input");
    await click(rows[0].querySelector(".o_boolean_toggle input"));

    assert.ok($(".modal").text().includes("Confirmation"), "Modal should ask to save changes");
    await contains(".modal .btn-primary").click();
    expect(["write", "web_read"]).toVerifySteps();
});

test("editable list view: multi edition with readonly modifiers", async () => {
    assert.expect(5);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree multi_edit="1">
                    <field name="id"/>
                    <field name="foo"/>
                    <field name="int_field" readonly="id > 2"/>
                </tree>`,
        mockRPC(route, args) {
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2], { int_field: 666 }], { message: "should only write on the valid records" });
            }
        },
    });

    // select all records
    await click(target.querySelector(".o_list_record_selector input"));
    ``; // edit a field
    await click(target.querySelectorAll(".o_data_row .o_data_cell")[1]);
    await editInput(target, ".o_data_row [name=int_field] input", 666);

    const modalText = target
        .querySelector(".modal-body")
        .textContent.split(" ")
        .filter((w) => w.trim() !== "")
        .join(" ")
        .split("\n")
        .join("");
    expect(modalText).toBe("Among the 4 selected records, 2 are valid for this update. Are you sure you want to " + "perform the following update on those 2 records? Field:int_fieldUpdate to:666");
    expect(target.querySelector(".modal .o_modal_changes .o_field_widget").parentNode.style.pointerEvents).toBe("none", { message: "pointer events should be deactivated on the demo widget" });

    await contains(".modal .btn-primary").click();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("1yop666", { message: "the first row should be updated" });
    expect($(target).find(".o_data_row:eq(1) .o_data_cell").text()).toBe("2blip666", { message: "the second row should be updated" });
});

test("editable list view: multi edition when the domain is selected", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree multi_edit="1" limit="2">
                    <field name="id"/>
                    <field name="int_field"/>
                </tree>`,
    });

    // select all records, and then select all domain
    await click(target.querySelector(".o_list_record_selector input"));
    await click(target.querySelector(".o_list_selection_box .o_list_select_domain"));

    // edit a field
    await click(target.querySelectorAll(".o_data_row .o_data_cell")[1]);
    await editInput(target, ".o_data_row [name=int_field] input", 666);
    assert.ok(target.querySelector(".modal-body").textContent.includes("This update will only consider the records of the current page."));
});

test("editable list view: many2one with readonly modifier", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="m2o" readonly="1"/>
                <field name="foo"/>
            </tree>`,
    });

    // edit a field
    await click(target.querySelector(".o_data_row .o_data_cell"));

    assert.containsOnce(target, '.o_data_row:eq(0) .o_data_cell:eq(0) div[name="m2o"] a');
    expect(document.activeElement).toBe(target.querySelectorAll(".o_data_row .o_data_cell")[1].querySelector("input"), { message: "focus should go to the char input" });
});

test("editable list view: multi edition server error handling", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree multi_edit="1"><field name="foo" required="1"/></tree>',
        mockRPC(route, args) {
            if (args.method === "write") {
                return Promise.reject();
            }
        },
    });

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit a line and confirm
    await click(rows[0].querySelector(".o_data_cell"));
    await contains(".o_selected_row [name=foo] input").edit("abc");
    await contains(".o_list_view").click();
    await contains(".modal .btn-primary").click();
    // Server error: if there was a crash manager, there would be an open error at this point...
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop", { message: "first cell should have discarded any change" });
    expect($(target).find(".o_data_row:eq(1) .o_data_cell").text()).toBe("blip", { message: "second selected record should not have changed" });
    expect(".o_data_cell input.o_field_widget").toHaveCount(0, { message: "no field should be editable anymore" });
});

test("editable readonly list view: navigation", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        selectRecord: (resId) => {
            assert.step(`resId: ${resId}`);
        },
    });

    expect(document.activeElement).toBe(target.querySelector(".o_searchview_input"));

    // ArrowDown two times must get to the checkbox selector of first data row
    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child .o_list_record_selector input"));

    // select the second record
    triggerHotkey("ArrowDown");
    await nextTick();
    let checkbox = target.querySelector(".o_data_row:nth-child(2) .o_list_record_selector input");
    expect(document.activeElement).toBe(checkbox);
    assert.ok(!checkbox.checked);
    let event = triggerEvent(checkbox, null, "keydown", { key: "Space" }, { sync: true });
    assert.ok(!event.defaultPrevented);
    checkbox.checked = true;
    await nextTick();
    expect(document.activeElement).toBe(checkbox);
    assert.ok(checkbox.checked);

    await triggerEvent(document.activeElement, null, "input");
    await triggerEvent(document.activeElement, null, "change");
    expect(document.activeElement).toBe(checkbox);
    assert.ok(checkbox.checked);

    // select the fourth record
    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowDown");
    await nextTick();
    checkbox = target.querySelector(".o_data_row:nth-child(4) .o_list_record_selector input");
    expect(document.activeElement).toBe(checkbox);
    assert.ok(!checkbox.checked);
    event = triggerEvent(checkbox, null, "keydown", { key: "Space" }, { sync: true });
    assert.ok(!event.defaultPrevented);
    checkbox.checked = true;
    await nextTick();
    expect(document.activeElement).toBe(checkbox);
    assert.ok(checkbox.checked);

    await triggerEvent(document.activeElement, null, "input");
    await triggerEvent(document.activeElement, null, "change");
    expect(document.activeElement).toBe(checkbox);
    assert.ok(checkbox.checked);

    // toggle a row mode
    triggerHotkey("ArrowUp");
    triggerHotkey("ArrowUp");
    triggerHotkey("ArrowRight");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo]"));
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));

    // Keyboard navigation only interracts with selected elements
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(4)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(4) [name=foo] input"));

    triggerHotkey("Tab"); // go to 4th row int_field
    triggerHotkey("Tab"); // go to 2nd row foo field
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=foo] input"));

    triggerHotkey("Tab"); // go to 2nd row int_field
    triggerHotkey("Tab"); // go to 4th row foo field
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(4)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(4) [name=foo] input"));

    triggerHotkey("Shift+Tab"); // go to 2nd row int_field
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(2)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(2) [name=int_field] input"));

    triggerHotkey("Shift+Tab"); // go to 2nd row foo field
    triggerHotkey("Shift+Tab"); // go to 4th row int_field field
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(4)").toHaveClass("o_selected_row");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:nth-child(4) [name=int_field] input"));

    // Clicking on an unselected row while a row is being edited will leave the edition
    await contains(".o_data_row:nth-child(3) [name=foo]").click();
    expect(".o_selected_row").toHaveCount(0);

    // Clicking on an unselected record while no row is being edited will open the record
    expect([]).toVerifySteps();
    await contains(".o_data_row:nth-child(3) [name=foo]").click();
    assert.verifySteps([`resId: 3`]);
});

test("editable list view: multi edition: edit and validate last row", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree multi_edit="1">
                    <field name="foo"/>
                    <field name="int_field"/>
                </tree>`,
    });
    expect(".o_data_row").toHaveCount(4);
    await click(target.querySelector(".o_list_view .o_list_record_selector input"));

    await contains(".o_data_row:last-child [name=int_field]").click();
    const input = target.querySelector(".o_data_row:last-child [name=int_field] input");
    input.value = 7;
    await triggerEvent(input, null, "input");
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=int_field] input"));
    triggerHotkey("Enter");
    await nextTick();
    expect(".modal").toHaveCount(1);
    await contains(".modal .btn-primary").click();
    expect(".o_data_row").toHaveCount(4);
});

test("editable readonly list view: navigation in grouped list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree multi_edit="1"><field name="foo"/></tree>`,
        groupBy: ["bar"],
        selectRecord: (resId) => {
            assert.step(`resId: ${resId}`);
        },
    });

    // Open both groups
    const groupHeaders = [...target.querySelectorAll(".o_group_header")];
    expect(".o_group_header").toHaveCount(2);
    await click(groupHeaders.shift());
    await click(groupHeaders.shift());

    // select 2 records
    const rows = [...target.querySelectorAll(".o_data_row")];
    expect(".o_data_row").toHaveCount(4);
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[2], ".o_list_record_selector input");

    // toggle a row mode
    await click(rows[0].querySelector("[name=foo]"));
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(rows[0], "o_selected_row");
    expect(document.activeElement).toBe(rows[0].querySelector("[name=foo] input"));

    // Keyboard navigation only interracts with selected elements
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(rows[2], "o_selected_row");
    expect(document.activeElement).toBe(rows[2].querySelector("[name=foo] input"));

    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(rows[0], "o_selected_row");
    expect(document.activeElement).toBe(rows[0].querySelector("[name=foo] input"));

    triggerHotkey("Tab");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(rows[2], "o_selected_row");
    expect(document.activeElement).toBe(rows[2].querySelector("[name=foo] input"));

    // Click on a non selected row
    await click(rows[3].querySelector("[name=foo]"));
    expect(".o_selected_row").toHaveCount(0);

    // Click again should select the clicked record
    await click(rows[3].querySelector("[name=foo]"));
    expect(["resId: 3"]).toVerifySteps();
});

test("editable readonly list view: single edition does not behave like a multi-edition", async () => {
    await mountView({
        type: "list",
        arch: `
                <tree multi_edit="1">
                    <field name="foo" required="1"/>
                </tree>`,
        resModel: "foo",
    });

    // select a record
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");

    // edit a field (invalid input)
    await click(rows[0].querySelector(".o_data_cell"));
    await editInput(target, ".o_data_row [name=foo] input", "");
    expect(".modal").toHaveCount(1, { message: "should have a modal (invalid fields)" });

    await contains(".modal button.btn").click();

    // edit a field
    await click(rows[0].querySelector(".o_data_cell"));
    await contains(".o_data_row [name=foo] input").edit("bar");
    expect(".modal").toHaveCount(0, { message: "should not have a modal" });
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("bar", { message: "the first row should be updated" });
});

test("non editable list view: multi edition", async () => {
    await mountView({
        type: "list",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method || route);
            if (args.method === "write") {
                expect(args.args).toEqual([[1, 2], { int_field: 666 }], { message: "should write on multi records" });
            } else if (args.method === "web_read") {
                if (args.args[0].length !== 1) {
                    expect(args.args).toEqual([[1, 2]], { message: "should batch the read" });
                    expect(args.kwargs.specification).toEqual({ foo: {}, int_field: {} });
                }
            }
        },
        resModel: "foo",
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();

    // select two records
    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[0], ".o_list_record_selector input");
    await click(rows[1], ".o_list_record_selector input");

    // edit a field
    await click(rows[0].querySelectorAll(".o_data_cell")[1]);
    await editInput(target, ".o_data_row [name=int_field] input", 666);
    await click(rows[0].querySelector(".o_data_cell"));
    expect(".modal").toHaveCount(1, { message: "modal appears when switching cells" });

    await contains(".modal .btn-secondary").click();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop10", { message: "changes have been discarded and row is back to readonly" });

    await click(rows[0].querySelectorAll(".o_data_cell")[1]);
    await editInput(target, ".o_data_row [name=int_field] input", 666);
    expect(".modal").toHaveCount(1, { message: "there should be an opened modal" });
    assert.ok($(".modal").text().includes("those 2 records"), "the number of records should be correctly displayed");

    await contains(".modal .btn-primary").click();
    expect(["write", "web_read"]).toVerifySteps();
    expect($(target).find(".o_data_row:eq(0) .o_data_cell").text()).toBe("yop666", { message: "the first row should be updated" });
    expect($(target).find(".o_data_row:eq(1) .o_data_cell").text()).toBe("blip666", { message: "the second row should be updated" });
    expect(".o_data_cell input.o_field_widget").toHaveCount(0, { message: "no field should be editable anymore" });
});

test("editable list view: m2m tags in grouped list", async () => {
    await mountView({
        arch: `
            <tree editable="top" multi_edit="1">
                <field name="bar"/>
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        groupBy: ["bar"],
        resModel: "foo",
        type: "list",
    });

    // Opens first group
    await click(target.querySelectorAll(".o_group_header")[1]);
    assert.notEqual(target.querySelector(".o_data_row").innerText, target.querySelectorAll(".o_data_row")[1].innerText, "First row and last row should have different values");

    await click(target.querySelector("thead .o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_field_many2many_tags"));
    await click(target.querySelector(".o_selected_row .o_field_many2many_tags .o_delete"));
    await click(target.querySelector(".modal .btn-primary"));
    expect(target.querySelector(".o_data_row").innerText).toBe(queryFirst(".o_data_row").innerText, { message: "All rows should have been correctly updated" });
});

test("editable list: edit many2one from external link", async () => {
    serverData.views = {
        "bar,false,form": `<form><field name="display_name"/></form>`,
    };

    await makeViewInDialog({
        arch: `
            <tree editable="top" multi_edit="1">
                <field name="m2o"/>
            </tree>`,
        mockRPC: async function (route, args) {
            if (args.method === "get_formview_id") {
                return false;
            }
        },
        resModel: "foo",
        type: "list",
    });

    expect(".o_dialog .o_list_view").toHaveCount(1);
    expect(".o_selected_row").toHaveCount(0);
    await click(target.querySelector("thead .o_list_record_selector input"));
    await click(target.querySelector(".o_data_row .o_data_cell"));
    expect(".o_selected_row").toHaveCount(1, { message: "in edit mode" });
    await click(target.querySelector(".o_external_button"));

    // Clicking somewhere on the form dialog should not close it
    // and should not leave edit mode
    expect(".modal[role='dialog']").toHaveCount(2);
    await click(target.querySelector(".modal[role='dialog']"));
    expect(".modal[role='dialog']").toHaveCount(2);
    expect(".o_selected_row").toHaveCount(1, { message: "in edit mode" });

    // Change the M2O value in the Form dialog (will open a confirmation dialog)
    await editInput(target.querySelectorAll(".modal")[1], "input", "OOF");
    await click(target.querySelectorAll(".modal")[1], ".o_form_button_save");
    expect(".modal[role='dialog']").toHaveCount(3);
    const confirmationDialog = target.querySelectorAll(".modal")[2];
    expect(confirmationDialog.querySelector(".modal .o_field_widget[name=m2o]").innerText).toBe("OOF", { message: "Value of the m2o should be updated in the confirmation dialog" });

    // Close the confirmation dialog
    await click(confirmationDialog, ".btn-primary");

    expect(target.querySelector(".o_data_cell").innerText).toBe("OOF", { message: "Value of the m2o should be updated in the list" });
});

test("editable list with fields with readonly modifier", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="bar"/>
                <field name="foo" readonly="bar"/>
                <field name="m2o" readonly="not bar"/>
                <field name="int_field"/>
            </tree>`,
    });

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_selected_row").toHaveCount(1);
    assert.notOk(target.querySelector(".o_selected_row .o_field_boolean input").checked);
    expect(".o_selected_row .o_field_char").not.toHaveClass("o_readonly_modifier");
    expect(".o_selected_row .o_field_many2one").toHaveClass("o_readonly_modifier");

    await click(target.querySelector(".o_selected_row .o_field_boolean input"));
    assert.ok(target.querySelector(".o_selected_row .o_field_boolean input").checked);
    expect(".o_selected_row .o_field_char").toHaveClass("o_readonly_modifier");
    expect(".o_selected_row .o_field_many2one").not.toHaveClass("o_readonly_modifier");

    await click(target.querySelector(".o_selected_row .o_field_many2one"));
    expect(document.activeElement).toBe(target.querySelector(".o_selected_row .o_field_many2one input"));
});

test("editable form with many2one: click out does not discard the row", async () => {
    serverData.models.bar.fields.m2o = {
        string: "M2O field",
        type: "many2one",
        relation: "foo",
    };

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
                <form>
                    <field name="display_name"/>
                    <field name="o2m">
                        <tree editable="bottom">
                            <field name="m2o" required="1"/>
                        </tree>
                    </field>
                </form>`,
    });

    expect(".o_data_row").toHaveCount(0);

    await click(target.querySelector(".o_field_x2many_list_row_add > a"));
    expect(".o_data_row").toHaveCount(1);

    // focus and write something in the m2o
    await contains(".o_field_many2one input").edit("abcdef");
    await nextTick();

    // simulate focus out
    await triggerEvent(target, ".o_field_many2one input", "blur");

    expect(".modal").toHaveCount(1, { message: "should ask confirmation to create a record" });
    expect(".o_data_row").toHaveCount(1, { message: "the row should still be there" });
});

test("editable form alongside html field: click out to unselect the row", async () => {
    // FIXME WOWL hack: add back the text field as html field removed by web_editor html_field file
    registry.category("fields").add("html", textField, { force: true });

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
                <form>
                    <field name="text" widget="html"/>
                    <field name="o2m">
                        <tree editable="bottom">
                            <field name="display_name"/>
                        </tree>
                    </field>
                </form>`,
    });

    expect(".o_data_row").toHaveCount(0);

    await addRow(target);
    expect(".o_data_row").toHaveCount(1);
    expect(".o_data_row").toHaveClass("o_selected_row");

    await editInput(target, '[name="o2m"] .o_field_x2many .o_selected_row [name="display_name"] input', "new value");

    // click outside to unselect the row
    await click(target.querySelector(".o_form_view"));
    expect(".o_data_row").toHaveCount(1);
    expect(".o_data_row").not.toHaveClass("o_selected_row");
});

test("list grouped by date:month", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="date"/></tree>',
        groupBy: ["date:month"],
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_group_header")].map((el) => el.innerText),
        ["January 2017 (1)", "None (3)"],
        "the group names should be correct"
    );
});

test("grouped list edition with boolean_favorite widget", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="bar" widget="boolean_favorite"/></tree>',
        groupBy: ["m2o"],
        mockRPC(route, args) {
            if (args.method === "write") {
                expect(args.args[1]).toEqual({ bar: false }, { message: "should write the correct value" });
            }
        },
    });

    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row:first .fa-star").toHaveCount(1, { message: "boolean value of the first record should be true" });
    await click(target.querySelector(".o_data_row .fa-star"));
    expect(".o_data_row:first .fa-star-o").toHaveCount(1, { message: "boolean value of the first record should have been updated" });
});

test("grouped list view, indentation for empty group", async () => {
    serverData.models.foo.fields.priority = {
        string: "Priority",
        type: "selection",
        selection: [
            [1, "Low"],
            [2, "Medium"],
            [3, "High"],
        ],
        default: 1,
    };
    serverData.models.foo.records.push({
        id: 5,
        foo: "blip",
        int_field: -7,
        m2o: 1,
        priority: 2,
    });
    serverData.models.foo.records.push({
        id: 6,
        foo: "blip",
        int_field: 5,
        m2o: 1,
        priority: 3,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="id"/></tree>',
        groupBy: ["priority", "m2o"],
        mockRPC(route, args) {
            // Override of the read_group to display the row even if there is no record in it,
            // to mock the behavihour of some fields e.g stage_id on the sale order.
            if (args.method === "web_read_group" && args.kwargs.groupby[0] === "m2o") {
                return Promise.resolve({
                    groups: [
                        {
                            id: 8,
                            m2o: [1, "Value 1"],
                            m2o_count: 0,
                        },
                        {
                            id: 2,
                            m2o: [2, "Value 2"],
                            m2o_count: 1,
                        },
                    ],
                    length: 1,
                });
            }
        },
    });

    // open the first group
    await click(target.querySelector(".o_group_header"));
    expect("tr:nth-child(1) th.o_group_name .fa").toHaveCount(1, { message: "There should be an element creating the indentation for the subgroup." });
    assert.notStrictEqual(getCssVar(target.querySelector("tr:nth-child(1) th.o_group_name span"), "--o-list-group-level").trim(), "", "The element creating the indentation should have a group level to use for margin css calculation.");
});

test("use the limit attribute in arch", async () => {
    assert.expect(4);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                expect(args.kwargs.limit).toBe(2, { message: "should use the correct limit value" });
            }
        },
    });
    expect(getPagerValue(target)).toEqual([1, 2]);
    expect(getPagerLimit(target)).toBe(4);
    expect(".o_data_row").toHaveCount(2, { message: "should display 2 data rows" });
});

test("concurrent reloads finishing in inverse order", async () => {
    let blockSearchRead = false;
    const def = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/></tree>',
        mockRPC: async function (route, args) {
            if (args.method === "web_search_read" && blockSearchRead) {
                await def;
            }
        },
        searchViewArch: `
            <search>
                <filter name="yop" domain="[('foo', '=', 'yop')]"/>
            </search>`,
    });

    expect(".o_list_view .o_data_row").toHaveCount(4, { message: "list view should contain 4 records" });

    // reload with a domain (this request is blocked)
    blockSearchRead = true;
    // list.reload({ domain: [["foo", "=", "yop"]] });
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "yop");
    expect(".o_list_view .o_data_row").toHaveCount(4, { message: "list view should still contain 4 records (search_read being blocked)" });

    // reload without the domain
    blockSearchRead = false;
    // list.reload({ domain: [] });
    // await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "yop");
    expect(".o_list_view .o_data_row").toHaveCount(4, { message: "list view should still contain 4 records" });

    // unblock the RPC
    def.resolve();
    await nextTick();
    expect(".o_list_view .o_data_row").toHaveCount(4, { message: "list view should still contain 4 records" });
});

test("list view move to previous page when all records from last page deleted", async () => {
    assert.expect(8);

    let checkSearchRead = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="3"><field name="display_name"/></tree>',
        mockRPC(route, args) {
            if (checkSearchRead && args.method === "web_search_read") {
                expect(args.kwargs.limit).toBe(3, { message: "limit should 3" });
                assert.notOk(args.kwargs.offset, "offset should not be passed i.e. offset 0 by default");
            }
        },
        actionMenus: {},
    });

    expect(getPagerValue(target)).toEqual([1, 3]);
    expect(getPagerLimit(target)).toBe(4);

    // move to next page
    await pagerNext(target);
    expect(getPagerValue(target)).toEqual([4, 4]);
    expect(getPagerLimit(target)).toBe(4);

    // delete a record
    await click(target.querySelector("tbody .o_data_row td.o_list_record_selector input"));
    checkSearchRead = true;
    await click(target.querySelector(".o_cp_action_menus .dropdown-toggle"));
    const deleteMenuItem = [...target.querySelectorAll(".o-dropdown--menu .o_menu_item")].filter((el) => el.innerText === "Delete")[0];
    await click(deleteMenuItem);
    await contains(".modal button.btn-primary").click();
    expect(getPagerValue(target)).toEqual([1, 3]);
    expect(getPagerLimit(target)).toBe(3);
});

test("grouped list view move to previous page of group when all records from last page deleted", async () => {
    assert.expect(10);

    let checkSearchRead = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="display_name"/></tree>',
        mockRPC(route, args) {
            if (checkSearchRead && args.method === "web_search_read") {
                expect(args.kwargs.limit).toBe(2, { message: "limit should 2" });
                assert.notOk(args.kwargs.offset, "offset should not be passed i.e. offset 0 by default");
            }
        },
        actionMenus: {},
        groupBy: ["m2o"],
    });

    expect("th:contains(Value 1 (3))").toHaveCount(1, { message: "Value 1 should contain 3 records" });
    expect("th:contains(Value 2 (1))").toHaveCount(1, { message: "Value 2 should contain 1 record" });
    const groupheader = target.querySelector(".o_group_header");
    await click(groupheader);
    expect(getPagerValue(groupheader)).toEqual([1, 2]);
    expect(getPagerLimit(groupheader)).toBe(3);

    // move to next page
    await pagerNext(groupheader);
    expect(getPagerValue(groupheader)).toEqual([3, 3]);
    expect(getPagerLimit(groupheader)).toBe(3);

    // delete a record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    checkSearchRead = true;
    await contains(".o_cp_action_menus .dropdown-toggle").click();
    await click([...target.querySelectorAll(".dropdown-item")].filter((el) => el.innerText === "Delete")[0]);
    await contains(".modal .btn-primary").click();

    expect($(target).find("th.o_group_name:eq(0) .o_pager_counter").text().trim()).toBe("", { message: "should be on first page now" });
    expect(".o_data_row").toHaveCount(2);
});

test("grouped list view move to next page when all records from the current page deleted", async () => {
    serverData.models.foo.records = [1, 2, 3, 4, 5, 6]
        .map((i) => ({
            id: i,
            foo: `yop${i}`,
            m2o: 1,
        }))
        .concat([{ id: 7, foo: "blip", m2o: 2 }]);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        actionMenus: {},
        groupBy: ["m2o"],
    });

    expect(target.querySelector("tr.o_group_header:first-child th").textContent.trim()).toBe("Value 1 (6)");
    expect(target.querySelector("tr.o_group_header:nth-child(2) th").textContent.trim()).toBe("Value 2 (1)");
    const firstGroup = target.querySelector("tr.o_group_header:first-child");
    await click(firstGroup);
    expect(getPagerValue(firstGroup)).toEqual([1, 2]);
    expect(getPagerLimit(firstGroup)).toBe(6);

    // delete all records from current page
    await click(target.querySelector("thead .o_list_record_selector input"));
    await contains(".o_cp_action_menus .dropdown-toggle").click();
    await click([...target.querySelectorAll(".dropdown-item")].filter((el) => el.innerText === "Delete")[0]);
    await contains(".modal .btn-primary").click();

    const groupLabel = "Value 1 (4)";
    const pagerText = "1-2 / 4";
    expect(target.querySelector(".o_group_header:nth-child(1) .o_group_name").textContent).toBe(`${groupLabel} ${pagerText}`);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row")].map((row) => row.textContent),
        ["yop3", "yop4"]
    );
});

test("list view move to previous page when all records from last page archive/unarchived", async () => {
    // add active field on foo model and make all records active
    serverData.models.foo.fields.active = {
        string: "Active",
        type: "boolean",
        default: true,
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="3"><field name="display_name"/></tree>',
        actionMenus: {},
        mockRPC(route) {
            if (route === "/web/dataset/call_kw/foo/action_archive") {
                serverData.models.foo.records[3].active = false;
                return {};
            }
        },
    });

    expect(target.querySelector(".o_pager_counter").textContent.trim()).toBe("1-3 / 4", { message: "should have 2 pages and current page should be first page" });
    expect(target.querySelectorAll("tbody td.o_list_record_selector").length).toBe(3, { message: "should have 3 records" });

    // move to next page
    await contains(".o_pager_next").click();
    expect(target.querySelector(".o_pager_counter").textContent.trim()).toBe("4-4 / 4", { message: "should be on second page" });
    expect(target.querySelectorAll("tbody td.o_list_record_selector").length).toBe(1, { message: "should have 1 records" });
    expect(".o_control_panel_actions .o_cp_action_menus").toHaveCount(0, { message: "sidebar should not be available" });

    await contains("tbody .o_data_row:first-child td.o_list_record_selector:first-child input").click();
    expect(".o_control_panel_actions .o_cp_action_menus").toHaveCount(1, { message: "sidebar should be available" });

    // archive all records of current page
    await toggleActionMenu(target);
    await toggleMenuItem(target, "Archive");
    expect(document.querySelectorAll(".modal").length).toBe(1, { message: "a confirm modal should be displayed" });

    await click(document, ".modal-footer .btn-primary");
    expect(target.querySelectorAll("tbody td.o_list_record_selector").length).toBe(3, { message: "should have 3 records" });
    expect(target.querySelector(".o_pager_counter").textContent.trim()).toBe("1-3 / 3", { message: "should have 1 page only" });
});

test("list should ask to scroll to top on page changes", async () => {
    patchWithCleanup(ListController.prototype, {
        onPageChangeScroll() {
            super.onPageChangeScroll(...arguments);
            assert.step("scroll");
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree limit="3"><field name="display_name"/></tree>`,
    });

    // switch pages (should ask to scroll)
    await contains(".o_pager_next").click();
    await contains(".o_pager_previous").click();
    assert.verifySteps(["scroll", "scroll"], "should ask to scroll when switching pages");

    // change the limit (should not ask to scroll)
    await click(target.querySelector(".o_pager_value"));
    await contains(".o_pager_value").edit("1-2");
    await nextTick();
    expect(target.querySelector(".o_pager_value").textContent).toBe("1-2");
    assert.verifySteps([], "should not ask to scroll when changing the limit");

    // switch pages again (should still ask to scroll)
    await contains(".o_pager_next").click();

    assert.verifySteps(["scroll"], "this is still working after a limit change");
});

test("list with handle field, override default_get, bottom when inline", async () => {
    serverData.models.foo.fields.int_field.default = 10;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom" default_order="int_field">
                    <field name="int_field" widget="handle"/>
                    <field name="foo"/>
                </tree>`,
    });

    // starting condition
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell.o_list_char")].map((el) => el.textContent),
        ["blip", "blip", "yop", "gnap"]
    );

    // click add a new line
    // save the record
    // check line is at the correct place

    const inputText = "ninja";
    await click($(".o_list_button_add:visible").get(0));
    await editInput(target, '[name="foo"] input', inputText);
    await clickSave(target);
    await click($(".o_list_button_add:visible").get(0));

    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell.o_list_char")].map((el) => el.textContent),
        ["blip", "blip", "yop", "gnap", inputText, ""]
    );
});

test("create record on list with modifiers depending on id", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="id" column_invisible="1"/>
                <field name="foo" readonly="id"/>
                <field name="int_field" invisible="id"/>
            </tree>`,
    });

    // add a new record
    await click($(".o_list_button_add:visible").get(0));

    // modifiers should be evaluted to false
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_selected_row [name=foo].o_field_widget").not.toHaveClass("o_readonly_modifier");
    expect(".o_selected_row div[name=int_field]").toHaveCount(1);

    // set a value and save
    await contains(".o_selected_row [name=foo] input").edit("some value");
    await clickSave(target);
    // int_field should not be displayed
    expect(target.querySelectorAll(".o_data_row .o_data_cell")[1].innerText).toBe("");

    // edit again the just created record
    await click(target.querySelector(".o_data_row .o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);
    // modifiers should be evaluated to true
    expect(".o_selected_row .o_field_widget[name=foo]").toHaveClass("o_readonly_modifier");
    expect(".o_selected_row div[name=int_field]").toHaveCount(0);
});

test("readonly boolean in editable list is readonly", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="bar" readonly="foo != 'yop'"/>
            </tree>`,
    });

    // clicking on disabled checkbox with active row does not work
    const rows = target.querySelectorAll(".o_data_row");
    const disabledCell = rows[1].querySelector("[name=bar]");
    await click(rows[1].querySelector(".o_data_cell"));
    assert.containsOnce(disabledCell, ":disabled:checked");
    await click(rows[1].querySelector("[name=bar] div"));
    assert.containsOnce(disabledCell, ":checked", "clicking disabled checkbox did not work");
    assert.ok($(document.activeElement).is('input[type="text"]'), "disabled checkbox is not focused after click");

    // clicking on enabled checkbox with active row toggles check mark
    await click(rows[0].querySelector(".o_data_cell"));
    const enabledCell = rows[0].querySelector("div[name=bar]");
    assert.containsOnce(enabledCell, ":checked:not(:disabled)");
    await click(rows[0].querySelector("div[name=bar] div"));
    assert.containsNone(enabledCell, ":checked", "clicking enabled checkbox worked and unchecked it");
    assert.ok($(document.activeElement).is('input[type="checkbox"]'), "enabled checkbox is focused after click");
});

test("grouped list with groups_limit attribute", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="3"><field name="foo"/></tree>',
        groupBy: ["int_field"],
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
    });

    expect(".o_group_header").toHaveCount(3); // page 1
    expect(".o_data_row").toHaveCount(0);
    expect(".o_pager").toHaveCount(1); // has a pager

    await pagerNext(target); // switch to page 2
    expect(".o_group_header").toHaveCount(1); // page 2
    expect(".o_data_row").toHaveCount(0);

    assert.verifySteps([
        "get_views",
        "web_read_group", // read_group page 1
        "web_read_group", // read_group page 2
    ]);
});

test("ungrouped list with groups_limit attribute, then group", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="3"><field name="foo"/></tree>',
        searchViewArch: `
            <search>
                <filter name="int_field" string="GroupBy IntField" context="{'group_by': 'int_field'}"/>
            </search>`,
    });

    expect(".o_data_row").toHaveCount(4);

    // add a custom group in searchview groupby
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "GroupBy IntField");

    expect(".o_group_header").toHaveCount(3);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-3", { message: "pager should be correct" });
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
});

test("grouped list with groups_limit attribute, then ungroup", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="3"><field name="foo"/></tree>',
        irFilters: [
            {
                context: "{'group_by': ['int_field']}",
                domain: "[]",
                id: 8,
                is_default: true,
                name: "GroupBy IntField",
                sort: "[]",
                user_id: [2, "Mitchell Admin"],
            },
        ],
    });

    expect(".o_group_header").toHaveCount(3);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-3", { message: "pager should be correct" });
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");

    // remove groupby
    await removeFacet(target);

    expect(".o_data_row").toHaveCount(4);
});

test("multi level grouped list with groups_limit attribute", async () => {
    for (let i = 50; i < 55; i++) {
        serverData.models.foo.records.push({ id: i, foo: "foo", int_field: i });
    }
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="3"><field name="foo"/></tree>',
        groupBy: ["foo", "int_field"],
    });

    expect(".o_group_header").toHaveCount(3);
    expect(target.querySelector(".o_pager_value").innerText).toBe("1-3", { message: "pager should be correct" });
    expect(target.querySelector(".o_pager_limit").innerText).toBe("4");
    expect(getNodesTextContent(target.querySelectorAll(".o_group_header"))).toEqual(["blip (2) ", "foo (5) ", "gnap (1) "]);

    // open foo group
    await click(target.querySelectorAll(".o_group_header")[1]);

    expect(".o_group_header").toHaveCount(6);
    expect(getNodesTextContent(target.querySelectorAll(".o_group_header"))).toEqual(["blip (2) ", "foo (5) 1-3 / 5", "50 (1) ", "51 (1) ", "52 (1) ", "gnap (1) "]);
});

test("grouped list with expand attribute", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree expand="1"><field name="foo"/></tree>',
        groupBy: ["bar"],
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
    });

    expect(".o_group_header").toHaveCount(2);
    expect(".o_data_row").toHaveCount(4);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["blip", "yop", "blip", "gnap"]
    );

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read"]).toVerifySteps();
});

test("grouped list with dynamic expand attribute (eval true)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree expand="context.get('expand', False)"><field name="foo"/></tree>`,
        context: {
            expand: true,
        },
        groupBy: ["bar"],
    });

    expect(".o_group_header").toHaveCount(2);
    expect(".o_data_row").toHaveCount(4);
});

test("grouped list with dynamic expand attribute (eval false)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree expand="context.get('expand', False)"><field name="foo"/></tree>`,
        context: {
            expand: false,
        },
        groupBy: ["bar"],
    });

    expect(".o_group_header").toHaveCount(2);
    expect(".o_data_row").toHaveCount(0);
});

test("grouped list (two levels) with expand attribute", async () => {
    // the expand attribute only opens the first level groups
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree expand="1"><field name="foo"/></tree>',
        groupBy: ["bar", "int_field"],
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
    });

    expect(".o_group_header").toHaveCount(6);

    assert.verifySteps([
        "get_views",
        "web_read_group", // global
        "web_read_group", // first group
        "web_read_group", // second group
    ]);
});

test("grouped lists with expand attribute and a lot of groups", async () => {
    for (var i = 0; i < 15; i++) {
        serverData.models.foo.records.push({ foo: "record " + i, int_field: i });
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree expand="1"><field name="foo"/></tree>',
        groupBy: ["int_field"],
        mockRPC(route, args) {
            if (args.method === "web_read_group") {
                assert.step(args.method);
            }
        },
    });

    expect(".o_group_header").toHaveCount(10); // page 1
    expect(".o_data_row").toHaveCount(10); // two groups contains two records
    expect(".o_pager").toHaveCount(1); // has a pager

    assert.deepEqual(
        [...target.querySelectorAll(".o_group_name")].map((el) => el.innerText),
        ["-4 (1)", "0 (1)", "1 (1)", "2 (1)", "3 (1)", "4 (1)", "5 (1)", "6 (1)", "7 (1)", "8 (1)"]
    );
    await pagerNext(target); // switch to page 2

    expect(".o_group_header").toHaveCount(7); // page 2
    expect(".o_data_row").toHaveCount(9); // two groups contains two records

    assert.deepEqual(
        [...target.querySelectorAll(".o_group_name")].map((el) => el.innerText),
        ["9 (2)", "10 (2)", "11 (1)", "12 (1)", "13 (1)", "14 (1)", "17 (1)"]
    );

    assert.verifySteps([
        "web_read_group", // read_group page 1
        "web_read_group", // read_group page 2
    ]);
});

test("add filter in a grouped list with a pager", async () => {
    serverData.actions = {
        11: {
            id: 11,
            name: "Action 11",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [9, "search"],
            context: { group_by: ["int_field"] },
        },
    };

    serverData.views = {
        "foo,3,list": '<tree groups_limit="3"><field name="foo"/></tree>',
        "foo,9,search": `
            <search>
                <filter string="Not Bar" name="not bar" domain="[['bar','=',False]]"/>
            </search>`,
    };

    const mockRPC = (route, args) => {
        if (args.method === "web_read_group") {
            assert.step(JSON.stringify(args.kwargs.domain) + ", " + args.kwargs.offset);
        }
    };

    const webClient = await createWebClient({ serverData, mockRPC });
    await doAction(webClient, 11);
    expect(".o_list_view").toHaveCount(1);
    expect(getPagerValue(target)).toEqual([1, 3]);
    expect(".o_group_header").toHaveCount(3); // page 1

    await pagerNext(target);
    expect(getPagerValue(target)).toEqual([4, 4]);
    expect(".o_group_header").toHaveCount(1); // page 2

    // toggle a filter -> there should be only one group left (on page 1)
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, 0);
    expect(getPagerValue(target)).toEqual([1, 1]);
    expect(".o_group_header").toHaveCount(1); // page 1

    assert.verifySteps(["[], 0", "[], 3", '[["bar","=",false]], 0']);
});

test("grouped list: have a group with pager, then apply filter", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="2"><field name="foo"/></tree>',
        searchViewArch: `
            <search>
                <filter name="Some Filter" domain="[('foo', '=', 'gnap')]"/>
            </search>`,
        groupBy: ["bar"],
    });

    expect(".o_data_row").toHaveCount(0);
    expect(".o_group_header").toHaveCount(2);

    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(".o_data_row").toHaveCount(2);
    expect(target.querySelector(".o_group_header .o_pager").innerText).toBe("1-2 / 3");

    await click(target.querySelector(".o_group_header .o_pager_next"));
    expect(".o_data_row").toHaveCount(1);
    expect(target.querySelector(".o_group_header .o_pager").innerText).toBe("3-3 / 3");

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Some Filter");

    expect(".o_data_row").toHaveCount(1);
    expect(".o_group_header").toHaveCount(1);
    expect(".o_group_header .o_pager").toHaveCount(0);
});

test("editable grouped lists", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="bar"/></tree>',
        searchViewArch: `
            <search>
                <filter name="bar" string="bar" context="{'group_by': 'bar'}"/>
            </search>`,
    });
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");
    await click(target.querySelector(".o_group_header"));

    // enter edition (grouped case)
    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);

    // click on the body should leave the edition
    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(0);

    // reload without groupBy
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");

    // enter edition (ungrouped case)
    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);

    // click on the body should leave the edition
    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(0);
});

test("grouped lists are editable (ungrouped first)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="bar"/></tree>',
        searchViewArch: `
            <search>
                <filter name="bar" string="bar" context="{'group_by': 'bar'}"/>
            </search>`,
    });

    // enter edition (ungrouped case)
    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);

    // reload with a groupby
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");

    // open first group
    await click(target.querySelector(".o_group_header"));

    // enter edition (grouped case)
    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);
});

test("char field edition in editable grouped list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
    });
    await click(target.querySelector(".o_group_header"));
    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_selected_row .o_data_cell [name="foo"] input', "pla");
    await clickSave(target);
    expect(serverData.models.foo.records[3].foo).toBe("pla", { message: "the edition should have been properly saved" });
    expect(".o_data_row:first:contains(pla)").toHaveCount(1);
});

test("control panel buttons in editable grouped list views", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="bar"/></tree>',
        searchViewArch: `
            <search>
                <filter name="bar" string="bar" context="{'group_by': 'bar'}"/>
            </search>`,
    });

    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });

    // reload with a groupby
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "bar");

    expect(".o_list_button_add:visible").toHaveCount(1);

    // reload without groupby
    await toggleMenuItem(target, "bar");

    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
});

test("control panel buttons in multi editable grouped list views", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["foo"],
        arch: `
                <tree multi_edit="1">
                    <field name="foo"/>
                    <field name="int_field"/>
                </tree>`,
    });

    expect(".o_data_row").toHaveCount(0, { message: "all groups should be closed" });
    expect($(".o_list_button_add:visible").length).toBe(1, { message: "should have a visible Create button" });

    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(2, { message: "first group should be opened" });
    expect($(".o_list_button_add:visible").length).toBe(1, { message: "should have a visible Create button" });

    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_data_row:eq(0) .o_list_record_selector input:enabled").toHaveCount(1, { message: "should have selected first record" });
    expect($(".o_list_button_add:visible").length).toBe(1, { message: "should have a visible Create button" });

    await click([...target.querySelectorAll(".o_group_header")].pop());
    expect(".o_data_row").toHaveCount(3, { message: "two groups should be opened" });
    expect($(".o_list_button_add:visible").length).toBe(1, { message: "should have a visible Create button" });
});

test("edit a line and discard it in grouped editable", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="int_field"/></tree>',
        groupBy: ["bar"],
    });

    await contains(".o_group_header:nth-child(2)").click();
    await contains(".o_data_row:nth-child(5) .o_data_cell:nth-child(2)").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(5)").toHaveClass("o_selected_row");

    await click($(".o_list_button_discard:visible").get(0));
    await contains(".o_data_row:nth-child(3) .o_data_cell:nth-child(2)").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(3)").toHaveClass("o_selected_row");

    await click($(".o_list_button_discard:visible").get(0));
    expect(".o_selected_row").toHaveCount(0);

    await contains(".o_data_row:nth-child(5) .o_data_cell:nth-child(2)").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row:nth-child(5)").toHaveClass("o_selected_row");
});

test("add and discard a record in a multi-level grouped list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo" required="1"/></tree>',
        groupBy: ["foo", "bar"],
    });

    // unfold first subgroup
    await click(target.querySelector(".o_group_header"));
    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(".o_group_header").toHaveClass("o_group_open");
    expect(".o_group_header").toHaveClass("o_group_open");
    expect(".o_data_row").toHaveCount(1);

    // add a record to first subgroup
    await contains(".o_group_field_row_add a").click();
    expect(".o_data_row").toHaveCount(2);

    // discard
    await clickDiscard(target);
    expect(".o_data_row").toHaveCount(1);
});

test("pressing ESC in editable grouped list should discard the current line changes", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
    });

    await click(target.querySelectorAll(".o_group_header")[1]); // open second group
    expect("tr.o_data_row").toHaveCount(3);

    await click(target.querySelector(".o_data_cell"));

    // update foo field of edited row
    await contains(".o_data_cell [name=foo] input").edit("new_value");
    expect(document.activeElement).toBe(target.querySelector(".o_data_cell [name=foo] input"));
    // discard by pressing ESC
    triggerHotkey("Escape");
    await nextTick();
    expect(".modal").toHaveCount(0);

    expect("tbody tr td:contains(yop)").toHaveCount(1);
    expect("tr.o_data_row").toHaveCount(3);
    expect("tr.o_data_row.o_selected_row").toHaveCount(0);
    expect(".o_list_button_save").not.toBeVisible();
});

test('pressing TAB in editable="bottom" grouped list', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/></tree>',
        groupBy: ["bar"],
    });

    // open two groups
    await click(getGroup(1));
    expect(".o_data_row").toHaveCount(1, { message: "first group contains 1 row" });

    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4, { message: "second group contains 3 rows" });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row:first").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to first line of second group
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(1)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to next line (still in second group)
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(2)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to next line (still in second group)
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(3)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go back to first line of first group
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:first").toHaveClass("o_selected_row");
});

test('pressing TAB in editable="top" grouped list', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
            </tree>`,
        groupBy: ["bar"],
    });

    // open two groups
    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(1);

    await click(target.querySelector(".o_group_header:last-child"));
    expect(".o_data_row").toHaveCount(4);

    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");

    const dataRows = [...target.querySelectorAll(".o_data_row")];
    dataRows.push(dataRows.shift());
    for (const row of dataRows) {
        triggerHotkey("Tab");
        await nextTick();
        assert.hasClass(row, "o_selected_row");
    }
});

test("pressing TAB in editable grouped list with create=0", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom" create="0"><field name="foo"/></tree>',
        groupBy: ["bar"],
    });

    // open two groups
    await click(getGroup(1));
    expect(".o_data_row").toHaveCount(1, { message: "first group contains 1 rows" });
    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4, { message: "first group contains 3 row" });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_data_row:first").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to the second group
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(1)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to next line (still in second group)
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(2)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go to next line (still in second group)
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:nth(3)").toHaveClass("o_selected_row");

    // Press 'Tab' -> should go back to first line of first group
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row:first").toHaveClass("o_selected_row");
});

test('pressing SHIFT-TAB in editable="bottom" grouped list', async () => {
    serverData.models.foo.records[2].bar = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo" required="1"/>
            </tree>`,
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(2);
    await click(target.querySelector(".o_group_header:last-child"));
    expect(".o_data_row").toHaveCount(4);

    // navigate inside a group
    const secondRow = target.querySelectorAll(".o_data_row")[1];
    await click(secondRow, ".o_data_cell");
    assert.hasClass(secondRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    const firstRow = target.querySelector(".o_data_row");
    assert.hasClass(firstRow, "o_selected_row");
    assert.doesNotHaveClass(secondRow, "o_selected_row");

    // navigate between groups
    const thirdRow = target.querySelectorAll(".o_data_row")[2];
    await click(thirdRow, ".o_data_cell");

    assert.hasClass(thirdRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    assert.hasClass(secondRow, "o_selected_row");
});

test('pressing SHIFT-TAB in editable="top" grouped list', async () => {
    serverData.models.foo.records[2].bar = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo" required="1"/>
            </tree>`,
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(2);
    await click(target.querySelector(".o_group_header:last-child"));
    expect(".o_data_row").toHaveCount(4);

    // navigate inside a group
    const secondRow = target.querySelectorAll(".o_data_row")[1];
    await click(secondRow, ".o_data_cell");
    assert.hasClass(secondRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    const firstRow = target.querySelector(".o_data_row");
    assert.hasClass(firstRow, "o_selected_row");
    assert.doesNotHaveClass(secondRow, "o_selected_row");

    // navigate between groups
    const thirdRow = target.querySelectorAll(".o_data_row")[2];
    await click(thirdRow, ".o_data_cell");

    assert.hasClass(thirdRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    assert.hasClass(secondRow, "o_selected_row");
});

test('pressing SHIFT-TAB in editable grouped list with create="0"', async () => {
    serverData.models.foo.records[2].bar = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top" create="0">
                    <field name="foo" required="1"/>
                </tree>`,
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    expect(".o_data_row").toHaveCount(2);
    await click(target.querySelector(".o_group_header:last-child"));
    expect(".o_data_row").toHaveCount(4);

    // navigate inside a group
    const secondRow = target.querySelectorAll(".o_data_row")[1];
    await click(secondRow, ".o_data_cell");
    assert.hasClass(secondRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    const firstRow = target.querySelector(".o_data_row");
    assert.hasClass(firstRow, "o_selected_row");
    assert.doesNotHaveClass(secondRow, "o_selected_row");

    // navigate between groups
    const thirdRow = target.querySelectorAll(".o_data_row")[2];
    await click(thirdRow, ".o_data_cell");

    assert.hasClass(thirdRow, "o_selected_row");

    triggerHotkey("shift+Tab");
    await nextTick();

    assert.hasClass(secondRow, "o_selected_row");
});

test("editing then pressing TAB in editable grouped list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
        groupBy: ["bar"],
    });

    // open two groups
    await click(getGroup(1));
    expect(".o_data_row").toHaveCount(1, { message: "first group contains 1 rows" });
    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4, { message: "first group contains 3 row" });

    // select and edit last row of first group
    await click(target.querySelector(".o_data_row").querySelector(".o_data_cell"));
    expect(".o_data_row:nth(0)").toHaveClass("o_selected_row");
    await editInput(target, '.o_selected_row [name="foo"] input', "new value");

    // Press 'Tab' -> should create a new record as we edited the previous one
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_data_row:nth(1)").toHaveClass("o_selected_row");

    // fill foo field for the new record and press 'tab' -> should create another record
    await editInput(target, '.o_selected_row [name="foo"] input', "new record");
    triggerHotkey("Tab");
    await nextTick();

    expect(".o_data_row").toHaveCount(6);
    expect(".o_data_row:nth(2)").toHaveClass("o_selected_row");

    // leave this new row empty and press tab -> should discard the new record and move to the
    // next group
    triggerHotkey("Tab");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_data_row:nth(2)").toHaveClass("o_selected_row");

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read", "web_save", "onchange", "web_save", "onchange"]).toVerifySteps();
});

test("editing then pressing TAB (with a readonly field) in grouped list", async () => {
    serverData.models.foo.records[0].bar = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                    <field name="int_field" readonly="1"/>
                </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    await click(target.querySelector(".o_data_row [name=foo]"));

    await contains(".o_selected_row [name=foo] input").edit("new value");

    triggerHotkey("Tab");
    await nextTick();

    expect(target.querySelector(".o_data_row [name=foo]").innerText).toBe("new value");

    const secondDataRow = target.querySelectorAll(".o_data_row")[1];
    expect(document.activeElement).toBe(secondDataRow.querySelector(".o_selected_row [name=foo] input"));

    expect(["get_views", "web_read_group", "web_search_read", "web_save"]).toVerifySteps();
});

test('pressing ENTER in editable="bottom" grouped list view', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo"/></tree>',
        mockRPC(route, args) {
            assert.step(args.method || route);
        },
        groupBy: ["bar"],
    });

    await click(getGroup(1)); // open first group
    await click(getGroup(2)); // open second group
    expect("tr.o_data_row").toHaveCount(4);

    const rows = target.querySelectorAll(".o_data_row");
    await click(rows[2].querySelector(".o_data_cell"));
    expect("tr.o_data_row:eq(2)").toHaveClass("o_selected_row");

    // press enter in input should move to next record
    triggerHotkey("Enter");
    await nextTick();

    expect("tr.o_data_row:eq(3)").toHaveClass("o_selected_row");
    expect("tr.o_data_row:eq(2)").not.toHaveClass("o_selected_row");

    // press enter on last row should create a new record
    triggerHotkey("Enter");
    await nextTick();

    expect("tr.o_data_row").toHaveCount(5);
    expect("tr.o_data_row:eq(4)").toHaveClass("o_selected_row");

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read", "onchange"]).toVerifySteps();
});

test('pressing ENTER in editable="top" grouped list view', async () => {
    serverData.models.foo.records[2].bar = false;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
            </tree>`,
        mockRPC(route, args) {
            assert.step(args.method);
        },
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    await click(target.querySelector(".o_group_header:last-child"));
    expect("tr.o_data_row").toHaveCount(4);

    await click(target.querySelector(".o_data_row .o_data_cell"));
    expect(".o_data_row").toHaveClass("o_selected_row");

    triggerHotkey("Enter");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");

    triggerHotkey("Enter");
    await nextTick();

    expect(".o_data_row").toHaveClass("o_selected_row");

    expect(["get_views", "web_read_group", "web_search_read", "web_search_read"]).toVerifySteps();
});

test("pressing ENTER in editable grouped list view with create=0", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom" create="0"><field name="foo"/></tree>',
        mockRPC(route, { method }) {
            assert.step(method);
        },
        groupBy: ["bar"],
    });
    expect(".o_group_header").toHaveCount(2);
    expect(".o_data_row").toHaveCount(0);
    expect(["get_views", "web_read_group"]).toVerifySteps();

    // Open group headers
    const [firstGroupHeader, secondGroupHeader] = [...target.querySelectorAll(".o_group_header")];
    await click(firstGroupHeader);
    await click(secondGroupHeader);
    expect(".o_data_row").toHaveCount(4);
    expect(".o_selected_row").toHaveCount(0);
    expect(["web_search_read", "web_search_read"]).toVerifySteps();

    // Click on first data row
    const dataRows = [...target.querySelectorAll(".o_data_row")];
    await click(dataRows[0].querySelector("[name=foo]"));
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(dataRows[0], "o_selected_row");
    expect(document.activeElement).toBe(dataRows[0].querySelector("[name=foo] input"));
    expect(dataRows[0]).toBe(target.querySelector("tbody tr:nth-child(2)"));

    // Press enter in input should move to next record, even if record is in another group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(dataRows[1], "o_selected_row");
    expect(document.activeElement).toBe(dataRows[1].querySelector("[name=foo] input"));
    expect(dataRows[1]).toBe(target.querySelector("tbody tr:nth-child(4)"));

    // Press enter in input should move to next record
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(dataRows[2], "o_selected_row");
    expect(document.activeElement).toBe(dataRows[2].querySelector("[name=foo] input"));
    expect(dataRows[2]).toBe(target.querySelector("tbody tr:nth-child(5)"));

    // Once again
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(dataRows[3], "o_selected_row");
    expect(document.activeElement).toBe(dataRows[3].querySelector("[name=foo] input"));
    expect(dataRows[3]).toBe(target.querySelector("tbody tr:nth-child(6)"));

    // Once again on the last data row should cycle to the first data row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_selected_row").toHaveCount(1);
    assert.hasClass(dataRows[0], "o_selected_row");
    expect(document.activeElement).toBe(dataRows[0].querySelector("[name=foo] input"));
    expect(dataRows[0]).toBe(target.querySelector("tbody tr:nth-child(2)"));

    expect([]).toVerifySteps();
});

test("cell-level keyboard navigation in non-editable list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo" required="1"/></tree>',
        selectRecord: (resId) => {
            assert.step(`resId: ${resId}`);
        },
    });

    expect(document.activeElement).toBe(target.querySelector(".o_searchview_input"));

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("thead .o_list_record_selector input"));

    triggerHotkey("ArrowUp");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_searchview_input"));

    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:first-child .o_list_record_selector input"));

    triggerHotkey("ArrowRight");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:first-child .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("yop");

    triggerHotkey("ArrowRight");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:first-child .o_field_cell[name=foo]"));

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(2) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("blip");

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(3) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("gnap");

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(4) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("blip");

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(4) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("blip");

    triggerHotkey("ArrowRight");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(4) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("blip");

    triggerHotkey("ArrowLeft");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(4) .o_list_record_selector input"));

    triggerHotkey("ArrowLeft");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(4) .o_list_record_selector input"));

    triggerHotkey("ArrowUp");
    triggerHotkey("ArrowRight");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody tr:nth-child(3) .o_field_cell[name=foo]"));
    expect(document.activeElement.textContent).toBe("gnap");

    triggerHotkey("Enter");
    await nextTick();
    expect(["resId: 3"]).toVerifySteps();
});

test("keyboard navigation from last cell in editable list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>
        `,
    });

    // Click on last cell
    await contains(".o_data_row:last-child [name=int_field]").click();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=int_field] input"));

    // Tab should focus the first field of first row
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=foo] input"));

    // Shift+Tab should focus back the last field of last row
    triggerHotkey("Shift+Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=int_field] input"));

    // Enter should add a new row at the bottom
    expect(".o_data_row").toHaveCount(4);
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=foo] input"));

    // Enter should discard the edited row as it is pristine + get to first row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(4);
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=foo] input"));

    // Click on last cell
    await contains(".o_data_row:last-child [name=int_field]").click();
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=int_field] input"));

    // Enter should add a new row at the bottom
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);

    // Edit the row and press enter: should add a new row
    const input = target.querySelector(".o_data_row:last-child [name=foo] input");
    expect(document.activeElement).toBe(input);
    input.value = "blork";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");
    expect(".o_data_row").toHaveCount(6);
    expect(document.activeElement).toBe(target.querySelector(".o_data_row:last-child [name=foo] input"));

    // Escape should discard the added row as it is pristine + view should go into readonly mode
    triggerHotkey("Escape");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(0);
});

test("keyboard navigation from last cell in editable grouped list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>
        `,
    });

    expect(".o_data_row").toHaveCount(0);
    expect(".o_group_header").toHaveCount(2);

    // Open first and second groups
    await click(getGroup(1));
    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4);

    // Click on last cell
    await click(getDataRow(4).querySelector("[name=int_field]"));
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Tab should focus the first field of first data row
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Shift+Tab should focus back the last field of last row
    triggerHotkey("Shift+Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Enter should add a new row at the bottom
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(document.activeElement).toBe(getDataRow(5).querySelector("[name=foo] input"));

    // Enter should discard the edited row as it is pristine + get to first row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(4);
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Click on last cell
    await click(getDataRow(4).querySelector("[name=int_field]"));
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Enter should add a new row at the bottom
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);

    // Edit the row and press enter: should add a new row
    let input = getDataRow(5).querySelector("[name=foo] input");
    expect(document.activeElement).toBe(input);
    input.value = "blork";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");
    expect(".o_data_row").toHaveCount(6);
    expect(document.activeElement).toBe(getDataRow(6).querySelector("[name=foo] input"));

    // Escape should discard the added row as it is pristine + view should go into readonly mode
    triggerHotkey("Escape");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(0);

    // Click on last data row of first group
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (1) -4");
    await click(getDataRow(1).querySelector("[name=foo]"));
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Enter should add a new row in the first group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(6);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (2) -4");

    // Enter should discard the edited row as it is pristine + get to next data row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (1) -4");
    expect(document.activeElement).toBe(getDataRow(2).querySelector("[name=foo] input"));

    // Shift+Tab should focus back the last field of first row
    triggerHotkey("Shift+Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=int_field] input"));

    // Enter should add a new row in the first group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(6);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (2) -4");

    // Edit the row and press enter: should add a new row
    input = getDataRow(2).querySelector("[name=foo] input");
    expect(document.activeElement).toBe(input);
    input.value = "zzapp";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");
    expect(".o_data_row").toHaveCount(7);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (3) -4");
    expect(document.activeElement).toBe(getDataRow(3).querySelector("[name=foo] input"));
});

test("keyboard navigation from last cell in multi-edit list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>
        `,
    });

    expect(".o_data_row").toHaveCount(0);
    expect(".o_group_header").toHaveCount(2);

    // Open first and second groups
    await click(getGroup(1));
    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4);

    // Click on last cell
    await click(getDataRow(4).querySelector("[name=int_field]"));
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Tab should focus the first field of first data row
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Shift+Tab should focus back the last field of last row
    triggerHotkey("Shift+Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Enter should add a new row at the bottom
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(document.activeElement).toBe(getDataRow(5).querySelector("[name=foo] input"));

    // Enter should discard the edited row as it is pristine + get to first row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(4);
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Click on last cell
    await click(getDataRow(4).querySelector("[name=int_field]"));
    expect(document.activeElement).toBe(getDataRow(4).querySelector("[name=int_field] input"));

    // Enter should add a new row at the bottom
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);

    // Edit the row and press enter: should add a new row
    let input = getDataRow(5).querySelector("[name=foo] input");
    expect(document.activeElement).toBe(input);
    input.value = "blork";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");
    expect(".o_data_row").toHaveCount(6);
    expect(document.activeElement).toBe(getDataRow(6).querySelector("[name=foo] input"));

    // Escape should discard the added row as it is pristine + view should go into readonly mode
    triggerHotkey("Escape");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    expect(".o_selected_row").toHaveCount(0);

    // Click on last data row of first group
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (1) -4");
    await click(getDataRow(1).querySelector("[name=foo]"));
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=foo] input"));

    // Enter should add a new row in the first group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(6);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (2) -4");

    // Enter should discard the edited row as it is pristine + get to next data row
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(5);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (1) -4");
    expect(document.activeElement).toBe(getDataRow(2).querySelector("[name=foo] input"));

    // Shift+Tab should focus back the last field of first row
    triggerHotkey("Shift+Tab");
    await nextTick();
    expect(document.activeElement).toBe(getDataRow(1).querySelector("[name=int_field] input"));

    // Enter should add a new row in the first group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(6);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (2) -4");

    // Edit the row and press enter: should add a new row
    input = getDataRow(2).querySelector("[name=foo] input");
    expect(document.activeElement).toBe(input);
    input.value = "zzapp";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");
    expect(".o_data_row").toHaveCount(7);
    assert.equal(getGroup(1).innerText.replace(/[\s\n]+/g, " "), "No (3) -4");
    expect(document.activeElement).toBe(getDataRow(3).querySelector("[name=foo] input"));
});

test("keyboard navigation with date range", async () => {
    serverData.models.foo.fields.date_end = { string: "Date End", type: "date" };
    serverData.models.foo.records[0].date_end = "2017-01-26";

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="date" widget="daterange" options="{'end_date_field': 'date_end'}" />
                <field name="int_field"/>
            </tree>
        `,
    });

    await contains(".o_data_row:first-child [name=foo]").click();

    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=foo] input"));

    triggerHotkey("Tab");
    await nextTick();

    const [startDateInput, endDateInput] = target.querySelectorAll(".o_data_row:first-child [name=date] input");

    expect(document.activeElement).toBe(startDateInput);

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(startDateInput, { message: "programmatic tab shouldn't toggle focus" });

    await click(endDateInput);

    expect(document.activeElement).toBe(endDateInput);

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=int_field] input"));
});

test("keyboard navigation with Many2One field", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
                <field name="m2o"/>
                <field name="int_field"/>
            </tree>
        `,
    });

    await contains(".o_data_row:first-child [name=foo]").click();

    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=foo] input"));

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=m2o] input"));

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector(".o_data_row:first-child [name=int_field] input"));
});

test("multi-edit records with ENTER does not crash", async () => {
    serviceRegistry.add("error", errorService);

    const def = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>
        `,
        async mockRPC(route, args) {
            if (args.method === "write") {
                await def;
            }
        },
    });

    await click(getDataRow(2).querySelector(".o_data_row .o_list_record_selector input"));
    await click(getDataRow(3).querySelector(".o_data_row .o_list_record_selector input"));
    await click(getDataRow(2).querySelector(".o_data_row .o_data_cell[name=int_field]"));

    expect(".o_selected_row").toHaveCount(1);
    const input = getDataRow(2).querySelector("[name=int_field] input");
    expect(document.activeElement).toBe(input);
    input.value = "234";
    await triggerEvent(input, null, "input");
    triggerHotkey("Enter");
    await triggerEvent(input, null, "change");

    expect(".o_dialog").toHaveCount(1); // confirmation dialog
    await click(target.querySelector(".o_dialog .modal-footer .btn-primary"));
    await new Promise((r) => setTimeout(r, 20)); // delay a bit the save s.t. there's a rendering
    def.resolve();
    await nextTick();
    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell.o_list_number"))).toEqual(["10", "234", "234", "-4"]);
    expect(".o_dialog").toHaveCount(0); // no more confirmation dialog, no error dialog
});

test("editable grouped list: adding a second record pass the first in readonly", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        groupBy: ["bar"],
        arch: `
            <tree editable="bottom">
                <field name="foo"/>
            </tree>
        `,
    });

    expect(".o_data_row").toHaveCount(0);
    expect(".o_group_header").toHaveCount(2);

    // Open first and second groups
    await click(getGroup(1));
    await click(getGroup(2));
    expect(".o_data_row").toHaveCount(4);
    assert.equal(getGroup(1).innerText, "No (1)");
    assert.equal(getGroup(2).innerText, "Yes (3)");

    // add a row in first group
    await click(queryFirst(".o_group_field_row_add a"));
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row").toHaveCount(5);
    assert.equal(getGroup(1).innerText, "No (2)");
    expect(document.activeElement).toBe(getDataRow(2).querySelector("[name=foo] input"));

    // add a row in second group
    await click(target.querySelectorAll(".o_group_field_row_add a")[1]);
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row").toHaveCount(5);
    assert.equal(getGroup(2).innerText, "Yes (4)");
    assert.equal(getGroup(1).innerText, "No (1)");
    expect(document.activeElement).toBe(getDataRow(5).querySelector("[name=foo] input"));
});

test("removing a groupby while adding a line from list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree multi_edit="1" editable="bottom">
                <field name="display_name"/>
                <field name="foo"/>
            </tree>`,
        searchViewArch: `
            <search>
                <field name="foo"/>
                <group expand="1" string="Group By">
                    <filter name="groupby_foo" context="{'group_by': 'foo'}"/>
                </group>
            </search>`,
    });

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Foo");

    // expand group
    await click(target.querySelector("th.o_group_name"));
    expect(".o_selected_row").toHaveCount(0);
    await click(target.querySelector("td.o_group_field_row_add a"));
    expect(".o_selected_row").toHaveCount(1);
    await contains(".o_searchview_facet .o_facet_remove").click();
    expect(".o_selected_row").toHaveCount(0);
});

test("cell-level keyboard navigation in editable grouped list", async () => {
    serverData.models.foo.records[0].bar = false;
    serverData.models.foo.records[1].bar = false;
    serverData.models.foo.records[2].bar = false;
    serverData.models.foo.records[3].bar = true;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="foo" required="1"/>
            </tree>`,
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_name"));
    const secondDataRow = target.querySelectorAll(".o_data_row")[1];
    await click(secondDataRow, "[name=foo]");
    assert.hasClass(secondDataRow, "o_selected_row");

    await editInput(secondDataRow, "[name=foo] input", "blipbloup");

    triggerHotkey("Escape");
    await nextTick();

    expect(".modal").toHaveCount(0);

    assert.doesNotHaveClass(secondDataRow, "o_selected_row");

    expect(document.activeElement).toBe(secondDataRow.querySelector("[name=foo]"));

    expect(document.activeElement.textContent).toBe("blip");

    triggerHotkey("ArrowLeft");

    expect(document.activeElement).toBe(secondDataRow.querySelector("input[type=checkbox]"));

    triggerHotkey("ArrowUp");
    triggerHotkey("ArrowRight");

    const firstDataRow = target.querySelector(".o_data_row");
    expect(document.activeElement).toBe(firstDataRow.querySelector("[name=foo]"));

    triggerHotkey("Enter");
    await nextTick();

    assert.hasClass(firstDataRow, "o_selected_row");
    await editInput(firstDataRow, "[name=foo] input", "Zipadeedoodah");

    triggerHotkey("Enter");
    await nextTick();

    expect(firstDataRow.querySelector("[name=foo]").innerText).toBe("Zipadeedoodah");
    assert.doesNotHaveClass(firstDataRow, "o_selected_row");
    assert.hasClass(secondDataRow, "o_selected_row");
    expect(document.activeElement).toBe(secondDataRow.querySelector("[name=foo] input"));
    expect(document.activeElement.value).toBe("blip");

    triggerHotkey("ArrowUp");
    triggerHotkey("ArrowRight");
    await nextTick();

    expect(document.activeElement).toBe(secondDataRow.querySelector("[name=foo] input"));
    expect(document.activeElement.value).toBe("blip");

    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowLeft");
    await nextTick();

    expect(document.activeElement).toBe(secondDataRow.querySelector("td[name=foo] input"));
    expect(document.activeElement.value).toBe("blip");

    triggerHotkey("Escape");
    await nextTick();

    assert.doesNotHaveClass(secondDataRow, "o_selected_row");

    expect(document.activeElement).toBe(secondDataRow.querySelector("td[name=foo]"));

    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowDown");

    expect(document.activeElement).toBe(target.querySelector(".o_group_field_row_add a"));

    triggerHotkey("ArrowDown");

    const secondGroupHeader = target.querySelectorAll(".o_group_name")[1];
    expect(document.activeElement).toBe(secondGroupHeader);

    expect(".o_data_row").toHaveCount(3);

    triggerHotkey("Enter");
    await nextTick();

    expect(".o_data_row").toHaveCount(4);

    expect(document.activeElement).toBe(secondGroupHeader);

    triggerHotkey("ArrowDown");

    const fourthDataRow = target.querySelectorAll(".o_data_row")[3];
    expect(document.activeElement).toBe(fourthDataRow.querySelector("[name=foo]"));

    triggerHotkey("ArrowDown");

    expect(document.activeElement).toBe(target.querySelectorAll(".o_group_field_row_add a")[1]);

    triggerHotkey("ArrowDown");

    expect(document.activeElement).toBe(target.querySelectorAll(".o_group_field_row_add a")[1]);

    // default Enter on a A tag
    const event = await triggerEvent(document.activeElement, null, "keydown", { key: "Enter" });
    assert.ok(!event.defaultPrevented);
    await click(target.querySelectorAll(".o_group_field_row_add a")[1]);

    const fifthDataRow = target.querySelectorAll(".o_data_row")[4];
    expect(document.activeElement).toBe(fifthDataRow.querySelector("[name=foo] input"));

    await editInput(fifthDataRow.querySelector("[name=foo] input"), null, "cheateur arrete de cheater");

    triggerHotkey("Enter");
    await nextTick();

    expect(".o_data_row").toHaveCount(6);

    triggerHotkey("Escape");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelectorAll(".o_group_field_row_add a")[1]);

    // come back to the top
    for (let i = 0; i < 9; i++) {
        triggerHotkey("ArrowUp");
    }

    expect(document.activeElement).toBe(target.querySelector("thead th:nth-child(2)"));

    triggerHotkey("ArrowLeft");

    expect(document.activeElement).toBe(target.querySelector("thead th.o_list_record_selector input"));

    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowDown");
    triggerHotkey("ArrowRight");

    expect(document.activeElement).toBe(firstDataRow.querySelector("td[name=foo]"));

    triggerHotkey("ArrowUp");

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    expect(".o_data_row").toHaveCount(5);

    triggerHotkey("Enter");
    await nextTick();

    expect(".o_data_row").toHaveCount(2);

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    triggerHotkey("ArrowRight");
    await nextTick();

    expect(".o_data_row").toHaveCount(5);

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    triggerHotkey("ArrowRight");
    await nextTick();

    expect(".o_data_row").toHaveCount(5);

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    triggerHotkey("ArrowLeft");
    await nextTick();

    expect(".o_data_row").toHaveCount(2);

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    triggerHotkey("ArrowLeft");
    await nextTick();

    expect(".o_data_row").toHaveCount(2);
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    triggerHotkey("ArrowDown");

    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(2) .o_group_name"));

    triggerHotkey("ArrowDown");

    const firstVisibleDataRow = target.querySelector(".o_data_row");
    expect(document.activeElement).toBe(firstVisibleDataRow.querySelector("[name=foo]"));

    triggerHotkey("ArrowDown");

    const secondVisibleDataRow = target.querySelectorAll(".o_data_row")[1];
    expect(document.activeElement).toBe(secondVisibleDataRow.querySelector("[name=foo]"));

    triggerHotkey("ArrowDown");

    expect(document.activeElement).toBe(target.querySelector(".o_group_field_row_add a"));

    triggerHotkey("ArrowUp");

    expect(document.activeElement).toBe(secondVisibleDataRow.querySelector("[name=foo]"));

    triggerHotkey("ArrowUp");
    expect(document.activeElement).toBe(firstVisibleDataRow.querySelector("[name=foo]"));
});

test("execute group header button with keyboard navigation", async () => {
    const list = await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <groupby name="m2o">
                    <button type="object" name="some_method" string="Do this"/>
                </groupby>
            </tree>`,
        groupBy: ["m2o"],
    });

    patchWithCleanup(list.env.services.action, {
        doActionButton: ({ name }) => {
            assert.step(name);
        },
    });

    expect(".o_data_row").toHaveCount(0);

    // focus create button as a starting point
    expect(".o_list_button_add").toHaveCount(2, { message: "Should have 2 add button (small and xl screens)" });
    $(".o_list_button_add:visible").get(0).focus();
    expect(document.activeElement).toBe($(".o_list_button_add:visible").get(0));

    triggerHotkey("ArrowDown");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector("thead th.o_list_record_selector input"));

    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    // unfold first group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(3);
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    // move to first record of opened group
    triggerHotkey("ArrowDown");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector("tbody .o_data_row td[name=foo]"));

    // move back to the group header
    triggerHotkey("ArrowUp");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    // fold the group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(0);
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    // unfold the group
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(3);
    expect(document.activeElement).toBe(target.querySelector(".o_group_header:nth-child(1) .o_group_name"));

    // tab to the group header button
    triggerHotkey("Tab");
    await nextTick();
    expect(document.activeElement).toBe(target.querySelector(".o_group_header .o_group_buttons button:first-child"));

    // click on the button by pressing enter
    expect([]).toVerifySteps();
    triggerHotkey("Enter");
    await nextTick();
    expect(".o_data_row").toHaveCount(3);
    expect(["some_method"]).toVerifySteps();
});

test('add a new row in grouped editable="top" list', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo" required="1"/></tree>',
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header")); // open group "No"
    await contains(".o_group_field_row_add a").click(); // add a new row
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(target.querySelector(".o_selected_row [name=foo] input")).toBe(document.activeElement, { message: "The first input of the line should have the focus" });
    expect(".o_data_row").toHaveCount(2);

    await clickDiscard(target);
    await click(target.querySelectorAll(".o_group_header")[1]); // open second group "Yes"
    expect(".o_data_row").toHaveCount(4);

    await click(target.querySelectorAll(".o_group_field_row_add a")[1]); // create row in second group "Yes"
    expect(target.querySelectorAll(".o_group_name")[1].innerText).toBe("Yes (4)", { message: "group should have correct name and count" });
    expect(".o_data_row").toHaveCount(5);
    expect(".o_data_row").toHaveClass("o_selected_row");

    await editInput(target, '.o_selected_row [name="foo"] input', "pla");
    await clickSave(target);
    expect(".o_data_row").toHaveCount(5);
});

test('add a new row in grouped editable="bottom" list', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo" required="1"/></tree>',
        groupBy: ["bar"],
    });
    await click(target.querySelector(".o_group_header")); // open group "No"
    await contains(".o_group_field_row_add a").click(); // add a new row
    expect(".o_data_row").toHaveClass("o_selected_row");
    expect(".o_data_row").toHaveCount(2);

    await clickDiscard(target);
    await click(target.querySelectorAll(".o_group_header")[1]); // open second group
    expect(".o_data_row").toHaveCount(4);
    await click(target.querySelectorAll(".o_group_field_row_add a")[1]); // create row in second group "Yes"
    expect(".o_data_row").toHaveClass("o_selected_row");

    await editInput(target, '.o_selected_row [name="foo"] input', "pla");
    await clickSave(target);
    expect(".o_data_row").toHaveCount(5);
});

test("add and discard a line through keyboard navigation without crashing", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="bottom"><field name="foo" required="1"/></tree>',
        groupBy: ["bar"],
    });

    // open the last group
    await contains(".o_group_header:last-child").click();
    expect(".o_data_row").toHaveCount(3);

    // Can trigger ENTER on "Add a line" link ?
    expect(".o_group_field_row_add a").toHaveCount(1);
    target.querySelector(".o_group_field_row_add a").focus();
    expect(document.activeElement).toBe(target.querySelector(".o_group_field_row_add a"));
    const event = await triggerEvent(document.activeElement, null, "keydown", {
        key: "Enter",
    });
    assert.ok(!event.defaultPrevented);
    // Simulate "enter" keydown
    await contains(".o_group_field_row_add a").click();

    expect(".o_data_row").toHaveCount(4);
    await click($(".o_list_button_discard:visible").get(0));
    // At this point, a crash manager should appear if no proper link targetting
    expect(".o_data_row").toHaveCount(3);
});

test("discard an invalid row in a list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top"><field name="foo" required="1"/></tree>',
    });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_field_invalid").toHaveCount(0);
    expect(".o_selected_row").toHaveCount(1);

    await editInput(target, "[name='foo'] input", "");
    await contains(".o_list_view").click();
    expect(".o_field_invalid").toHaveCount(1);
    expect(".o_selected_row").toHaveCount(1);
    expect(target.querySelector("[name='foo'] input").value).toBe("");

    await clickDiscard(target);
    expect(".o_field_invalid").toHaveCount(0);
    expect(".o_selected_row").toHaveCount(0);
    expect(target.querySelector("[name='foo']").textContent).toBe("yop");
});

test('editable grouped list with create="0"', async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top" create="0"><field name="foo" required="1"/></tree>',
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header")); // open group
    expect(".o_group_field_row_add a").toHaveCount(0, { message: "Add a line should not be available in readonly" });
});

test("add a new row in (selection) grouped editable list", async () => {
    serverData.models.foo.fields.priority = {
        string: "Priority",
        type: "selection",
        selection: [
            [1, "Low"],
            [2, "Medium"],
            [3, "High"],
        ],
        default: 1,
    };
    serverData.models.foo.records.push({
        id: 5,
        foo: "blip",
        int_field: -7,
        m2o: 1,
        priority: 2,
    });
    serverData.models.foo.records.push({
        id: 6,
        foo: "blip",
        int_field: 5,
        m2o: 1,
        priority: 3,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="priority"/>
                <field name="m2o"/>
            </tree>`,
        groupBy: ["priority"],
        mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.step(args.kwargs.context.default_priority.toString());
            }
        },
    });
    await click(target.querySelector(".o_group_header")); // open group
    await click(target.querySelector(".o_group_field_row_add a")); // add a new row
    await editInput(target, '[name="foo"] input', "xyz"); // make record dirty
    await contains(".o_list_view").click(); // unselect row
    expect(["1"]).toVerifySteps();
    expect(target.querySelectorAll(".o_data_row .o_data_cell")[1].textContent).toBe("Low", { message: "should have a column name with a value from the groupby" });

    await click(target.querySelectorAll(".o_group_header")[1]); // open second group
    await click(target.querySelectorAll(".o_group_field_row_add a")[1]); // create row in second group
    await contains(".o_list_view").click(); // unselect row
    expect(target.querySelectorAll(".o_data_row")[5].querySelectorAll(".o_data_cell")[1].textContent).toBe("Medium", { message: "should have a column name with a value from the groupby" });
    expect(["2"]).toVerifySteps();
});

test("add a new row in (m2o) grouped editable list", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="m2o"/>
            </tree>`,
        groupBy: ["m2o"],
        mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.step(args.kwargs.context.default_m2o.toString());
            }
        },
    });
    await click(target.querySelector(".o_group_header")); // open group
    await click(target.querySelector(".o_group_field_row_add a")); // add a new row
    await contains(".o_list_view").click(); // unselect row
    expect(target.querySelector(".o_data_row").querySelectorAll(".o_data_cell")[1].textContent).toBe("Value 1", { message: "should have a column name with a value from the groupby" });
    expect(["1"]).toVerifySteps();

    await click(target.querySelectorAll(".o_group_header")[1]); // open second group
    await click(target.querySelectorAll(".o_group_field_row_add a")[1]); // create row in second group
    await contains(".o_list_view").click(); // unselect row
    expect(target.querySelectorAll(".o_data_row")[3].querySelectorAll(".o_data_cell")[1].textContent).toBe("Value 2", { message: "should have a column name with a value from the groupby" });
    expect(["2"]).toVerifySteps();
});

test("list view with optional fields rendering", async () => {
    patchWithCleanup(localization, {
        direction: "ltr",
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2o" optional="hide"/>
                <field name="amount"/>
                <field name="reference" optional="hide"/>
            </tree>`,
    });

    expect("th").toHaveCount(4, { message: "should have 4 th, 1 for selector, 2 for columns and 1 for optional columns" });

    expect("tfoot td").toHaveCount(4, { message: "should have 4 td, 1 for selector, 2 for columns and 1 for optional columns" });

    expect("table .o_optional_columns_dropdown").toHaveCount(1, { message: "should have the optional columns dropdown toggle inside the table" });

    expect("table > thead > tr > th:last-child .o_optional_columns_dropdown").toHaveCount(1, { message: "The optional fields toggler is in the last header column" });

    // optional fields
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    expect(".o-dropdown--menu span.dropdown-item").toHaveCount(2, { message: "dropdown have 2 optional field foo with checked and bar with unchecked" });

    // enable optional field
    await contains(".o-dropdown--menu span.dropdown-item:first-child").click();
    // 5 th (1 for checkbox, 3 for columns, 1 for optional columns)
    expect("th").toHaveCount(5, { message: "should have 5 th" });
    expect("tfoot td").toHaveCount(5, { message: "should have 5 td" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field

    expect(queryFirst(".o-dropdown--menu span.dropdown-item:first-child input:checked")).toBe([...target.querySelectorAll(".o-dropdown--menu span.dropdown-item")].filter((el) => el.innerText === "M2O field")[0].querySelector("input"), { message: "m2o advanced field check box should be checked in dropdown" });

    await contains(".o-dropdown--menu span.dropdown-item:first-child").click();
    // 4 th (1 for checkbox, 2 for columns, 1 for optional columns)
    expect("th").toHaveCount(4, { message: "should have 4 th" });
    expect("tfoot td").toHaveCount(4, { message: "should have 4 td" });
    assert.notOk($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should not have a visible m2o field"); //m2o field not displayed

    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    assert.notOk($(target).find('.o-dropdown--menu span.dropdown-item [name="m2o"]').is(":checked"));
});

test("list view with optional fields rendering in RTL mode", async () => {
    patchWithCleanup(localization, {
        direction: "rtl",
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2o" optional="hide"/>
                <field name="amount"/>
                <field name="reference" optional="hide"/>
            </tree>`,
    });

    expect("table .o_optional_columns_dropdown").toHaveCount(1, { message: "should have the optional columns dropdown toggle inside the table" });

    expect("table > thead > tr > th:last-child .o_optional_columns_dropdown").toHaveCount(1, { message: "The optional fields toggler is in the last header column" });
});

test("optional fields do not disappear even after listview reload", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="foo"/>
                    <field name="m2o" optional="hide"/>
                    <field name="amount"/>
                    <field name="reference" optional="hide"/>
                </tree>`,
    });

    expect("th").toHaveCount(4, { message: "should have 3 th, 1 for selector, 2 for columns, 1 for optional columns" });

    // enable optional field
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    assert.notOk(target.querySelector(".o-dropdown--menu span.dropdown-item:first-child input").checked);
    await contains(".o-dropdown--menu span.dropdown-item:first-child").click();
    expect("th").toHaveCount(5, { message: "should have 5 th 1 for selector, 3 for columns, 1 for optional columns" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field

    var firstRowSelector = target.querySelector("tbody .o_list_record_selector input");
    await click(firstRowSelector);
    await reloadListView(target);
    expect("th").toHaveCount(5, { message: "should have 5 th 1 for selector, 3 for columns, 1 for optional columns ever after listview reload" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field even after listview reload");

    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    assert.ok(target.querySelector(".o-dropdown--menu span.dropdown-item:first-child input").checked);
});

test("optional fields is shown only if enabled", async () => {
    serverData.actions = {
        1: {
            id: 1,
            name: "Currency Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[1, "list"]],
        },
    };

    serverData.views = {
        "foo,1,list": `
                <tree>
                    <field name="currency_id" optional="show"/>
                    <field name="company_currency_id" optional="show"/>
                </tree>`,
        "foo,false,search": "<search/>",
    };

    const webClient = await createWebClient({ serverData });
    await doAction(webClient, 1);

    expect("th").toHaveCount(4, { message: "should have 4 th, 1 for selector, 2 for columns, 1 for optional columns" });

    // disable optional field
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    await contains(".o-dropdown--menu span.dropdown-item:first-child").click();
    expect("th").toHaveCount(3, { message: "should have 3 th, 1 for selector, 1 for columns, 1 for optional columns" });

    await doAction(webClient, 1);
    expect("th").toHaveCount(3, { message: "should have 3 th, 1 for selector, 1 for columns, 1 for optional columns ever after listview reload" });
});

test("selection is kept when optional fields are toggled", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="m2o" optional="hide"/>
            </tree>`,
    });

    expect("th").toHaveCount(3);

    // select a record
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    expect(".o_list_record_selector input:checked").toHaveCount(1);

    // add an optional field
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    await contains(".o-dropdown--menu span.dropdown-item:first-child label").click();
    expect("th").toHaveCount(4);
    expect(".o_list_record_selector input:checked").toHaveCount(1);

    // select all records
    await contains("thead .o_list_record_selector input").click();
    expect(".o_list_record_selector input:checked").toHaveCount(5);

    // remove an optional field
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    await contains(".o-dropdown--menu span.dropdown-item:first-child label").click();
    expect("th").toHaveCount(3);
    expect(".o_list_record_selector input:checked").toHaveCount(5);
});

test("list view with optional fields and async rendering", async () => {
    assert.expect(14);

    const def = makeDeferred();
    const fieldRegistry = registry.category("fields");
    const charField = fieldRegistry.get("char");

    class AsyncCharField extends charField.component {
        setup() {
            super.setup();
            onWillStart(async () => {
                assert.ok(true, "the rendering must be async");
                await def;
            });
        }
    }
    fieldRegistry.add("asyncwidget", { component: AsyncCharField });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="m2o"/>
                <field name="foo" widget="asyncwidget" optional="hide"/>
            </tree>`,
    });

    expect("th").toHaveCount(3);
    expect(".o_optional_columns_dropdown .show").toHaveCount(0);

    // add an optional field (we click on the label on purpose, as it will trigger
    // a second event on the input)
    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();
    expect(".o_optional_columns_dropdown .show").toHaveCount(1);
    expect(".o-dropdown--menu input:checked").toHaveCount(0);

    await contains(".o-dropdown--menu span.dropdown-item:first-child label").click();
    expect("th").toHaveCount(3);
    expect(".o_optional_columns_dropdown .show").toHaveCount(1);
    expect(".o-dropdown--menu input:checked").toHaveCount(1);

    def.resolve();
    await nextTick();
    expect("th").toHaveCount(4);
    expect(".o_optional_columns_dropdown .show").toHaveCount(1);
    expect(".o-dropdown--menu input:checked").toHaveCount(1);
});

test("change the viewType of the current action", async () => {
    serverData.actions = {
        1: {
            id: 1,
            name: "Partners Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[1, "kanban"]],
        },
        2: {
            id: 2,
            name: "Partners",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [
                [false, "list"],
                [1, "kanban"],
            ],
        },
    };

    serverData.views = {
        "foo,1,kanban": '<kanban><templates><t t-name="kanban-box">' + '<div class="oe_kanban_global_click"><field name="foo"/></div>' + "</t></templates></kanban>",

        "foo,false,list": '<tree limit="3">' + '<field name="foo"/>' + '<field name="m2o" optional="hide"/>' + '<field name="o2m" optional="show"/></tree>',

        "foo,false,search": '<search><field name="foo" string="Foo"/></search>',
    };

    const webClient = await createWebClient({ serverData });

    await doAction(webClient, 2);

    expect(".o_list_view").toHaveCount(1, { message: "should have rendered a list view" });

    expect("th").toHaveCount(4, { message: "should display 4 th (selector + 2 fields + optional columns)" });

    // enable optional field
    await contains("table .o_optional_columns_dropdown_toggle").click();

    assert.notOk($(target).find('.o-dropdown--menu span.dropdown-item [name="m2o"]').is(":checked"));
    assert.ok($(target).find('.o-dropdown--menu span.dropdown-item [name="o2m"]').is(":checked"));

    await click(target.querySelector(".o-dropdown--menu span.dropdown-item"));
    expect("th").toHaveCount(5, { message: "should display 5 th (selector + 3 fields + optional columns)" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field

    // switch to kanban view
    await click(target.querySelector(".o_switch_view.o_kanban"));

    expect(".o_list_view").toHaveCount(0, { message: "should not display the list view anymore" });
    expect(".o_kanban_view").toHaveCount(1, { message: "should have switched to the kanban view" });

    // switch back to list view
    await click(target.querySelector(".o_switch_view.o_list"));

    expect(".o_kanban_view").toHaveCount(0, { message: "should not display the kanban view anymoe" });
    expect(".o_list_view").toHaveCount(1, { message: "should display the list view" });

    expect("th").toHaveCount(5, { message: "should display 5 th" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(O2M field)").is(":visible"), "should have a visible o2m field"); //o2m field

    // disable optional field
    await contains("table .o_optional_columns_dropdown_toggle").click();
    assert.ok($(target).find('.o-dropdown--menu span.dropdown-item [name="m2o"]').is(":checked"));
    assert.ok($(target).find('.o-dropdown--menu span.dropdown-item [name="o2m"]').is(":checked"));
    await click(target.querySelectorAll(".o-dropdown--menu span.dropdown-item input")[1]);
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field
    assert.notOk($(target).find("th:not(.o_list_actions_header):contains(O2M field)").is(":visible"), "shouldn't have a visible o2m field"); //o2m field
    expect("th").toHaveCount(4, { message: "should display 4 th" });

    await doAction(webClient, 1);

    expect(".o_list_view").toHaveCount(0, { message: "should not display the list view anymore" });
    expect(".o_kanban_view").toHaveCount(1, { message: "should have switched to the kanban view" });

    await doAction(webClient, 2);

    expect(".o_kanban_view").toHaveCount(0, { message: "should not havethe kanban view anymoe" });
    expect(".o_list_view").toHaveCount(1, { message: "should display the list view" });

    expect("th").toHaveCount(4, { message: "should display 4 th" });
    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field
    assert.notOk($(target).find("th:not(.o_list_actions_header):contains(O2M field)").is(":visible"), "shouldn't have a visible o2m field"); //o2m field
});

test("list view with optional fields rendering and local storage mock", async () => {
    let forceLocalStorage = true;

    patchWithCleanup(browser.localStorage, {
        getItem(key) {
            assert.step("getItem " + key);
            return forceLocalStorage ? "m2o" : super.getItem(...arguments);
        },
        setItem(key, value) {
            assert.step("setItem " + key + " to " + JSON.stringify(String(value)));
            return super.setItem(...arguments);
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree>
                    <field name="foo"/>
                    <field name="m2o" optional="hide"/>
                    <field name="reference" optional="show"/>
                </tree>`,
        viewId: 42,
    });

    const localStorageKey = "optional_fields,foo,list,42,foo,m2o,reference";

    assert.verifySteps(["getItem " + localStorageKey]);

    expect("th").toHaveCount(4, { message: "should have 4 th, 1 for selector, 2 for columns, 1 for optional columns" });

    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field

    assert.notOk($(target).find("th:not(.o_list_actions_header):contains(Reference Field)").is(":visible"), "should not have a visible reference field");

    // optional fields
    await click(target.querySelector("table .o_optional_columns_dropdown button"));
    expect(".o-dropdown--menu span.dropdown-item").toHaveCount(2, { message: "dropdown have 2 optional fields" });

    forceLocalStorage = false;
    // enable optional field
    await click($(target).find(".o-dropdown--menu span.dropdown-item:eq(1) input")[0]);

    // Only a setItem since the list view maintains its own internal state of toggled
    // optional columns.
    assert.verifySteps(["setItem " + localStorageKey + ' to "m2o,reference"', "getItem optional_fields,foo,list,42,foo,m2o,reference"]);

    // 5 th (1 for checkbox, 3 for columns, 1 for optional columns)
    expect("th").toHaveCount(5, { message: "should have 5 th" });

    assert.ok($(target).find("th:not(.o_list_actions_header):contains(M2O field)").is(":visible"), "should have a visible m2o field"); //m2o field

    assert.ok($(target).find("th:not(.o_list_actions_header):contains(Reference Field)").is(":visible"), "should have a visible reference field");
});

test("list view with optional fields from local storage being the empty array", async () => {
    patchWithCleanup(browser.localStorage, {
        getItem(key) {
            assert.step("getItem " + key);
            return super.getItem(...arguments);
        },
        setItem(key, value) {
            assert.step("setItem " + key + " to " + JSON.stringify(String(value)));
            super.setItem(...arguments);
        },
    });

    const verifyHeaders = (namedHeaders) => {
        const headers = [...target.querySelectorAll(".o_list_table thead th")];
        assert.hasClass(headers[0], "o_list_record_selector");
        assert.hasClass(headers[headers.length - 1], "o_list_actions_header");
        assert.equal(headers.length, namedHeaders.length + 2, `list has ${namedHeaders.length + 2} headers`);
        for (let i = 1; i < headers.length - 1; i++) {
            assert.equal(headers[i].dataset.name, namedHeaders[i - 1], `header at index ${i} is ${namedHeaders[i - 1]}`);
        }
    };

    serverData.actions = {
        1: {
            id: 1,
            name: "Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[42, "list"]],
            search_view_id: [1, "search"],
        },
    };
    serverData.views = {
        "foo,1,search": "<search></search>",
        "foo,42,list": `
                <tree>
                    <field name="foo"/>
                    <field name="m2o" optional="hide"/>
                    <field name="reference" optional="show"/>
                </tree>`,
    };
    const localStorageKey = "optional_fields,foo,list,42,foo,m2o,reference";
    const webClient = await createWebClient({ serverData });
    await doAction(webClient, 1);

    // verify initialization
    assert.verifySteps(["getItem " + localStorageKey]);
    verifyHeaders(["foo", "reference"]);
    // open optional columns headers dropdown
    await click(target.querySelector("table .o_optional_columns_dropdown button"));
    expect(".o-dropdown--menu span.dropdown-item").toHaveCount(2, { message: "dropdown has 2 optional column headers" });
    // disable optional field "reference" (no optional column enabled)
    await click(target.querySelectorAll(".o-dropdown--menu span.dropdown-item input")[1]);
    assert.verifySteps(["setItem " + localStorageKey + ' to ""', "getItem optional_fields,foo,list,42,foo,m2o,reference"]);
    verifyHeaders(["foo"]);
    // mount again to ensure that active optional columns will not be reset while empty
    await doAction(webClient, 1);
    assert.verifySteps(["getItem " + localStorageKey]);
    verifyHeaders(["foo"]);
});

test("quickcreate in a many2one in a list", async () => {
    await mountView({
        type: "list",
        arch: '<tree editable="top"><field name="m2o"/></tree>',
        resModel: "foo",
    });
    await click(target.querySelector(".o_data_row .o_data_cell"));

    const input = target.querySelector(".o_data_row .o_data_cell input");
    await editInput(input, null, "aaa");
    await triggerEvents(input, null, ["keyup", "blur"]);
    document.body.click();
    await nextTick();
    expect(".modal").toHaveCount(1, { message: "the quick_create modal should appear" });

    await click(target.querySelector(".modal .btn-primary"));
    await click(target.querySelector(".o_list_view"));
    expect(target.getElementsByClassName("o_data_cell")[0].innerHTML).toBe("aaa", { message: "value should have been updated" });
});

test("float field render with digits attribute on listview", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="qux" digits="[12,6]"/></tree>',
    });

    expect(target.querySelector("td.o_list_number").textContent).toBe("0.400000", { message: "should contain 6 digits decimal precision" });
});

test("list: column: resize, reorder, resize again", async () => {
    serverData.models.foo.fields.foo.sortable = true;
    serverData.models.foo.fields.int_field.sortable = true;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    // pointer doesn't perfectly match the resized th.
    const PIXEL_TOLERANCE = 3;
    const assertAlmostEqual = (v1, v2) => Math.abs(v1 - v2) <= PIXEL_TOLERANCE;

    // 1. Resize column foo to middle of column int_field.
    const originalWidths = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);
    const th2 = target.querySelector("th:nth-child(2)");
    const th3 = target.querySelector("th:nth-child(3)");
    const resizeHandle = th2.querySelector(".o_resize");

    await dragAndDrop(resizeHandle, th3);

    const widthsAfterResize = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);

    expect(widthsAfterResize[0]).toBe(originalWidths[0]);
    assertAlmostEqual(widthsAfterResize[1], originalWidths[1] + originalWidths[2] / 2);

    // 2. Reorder column foo.
    await click(th2);
    const widthsAfterReorder = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);

    expect(widthsAfterResize[0]).toBe(widthsAfterReorder[0]);
    expect(widthsAfterResize[1]).toBe(widthsAfterReorder[1]);

    // 3. Resize again, this time check sizes while dragging and after drop.
    const { drop } = await drag(resizeHandle, th3);
    assertAlmostEqual(th2.offsetWidth, widthsAfterReorder[1] + widthsAfterReorder[2] / 2);

    await drop();
    assertAlmostEqual(th2.offsetWidth, widthsAfterReorder[1] + widthsAfterReorder[2] / 2);
});

test("list: resize column and toggle one checkbox", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    // 1. Resize column foo to middle of column int_field.
    const th2 = target.querySelector("th:nth-child(2)");
    const th3 = target.querySelector("th:nth-child(3)");
    const resizeHandle = th2.querySelector(".o_resize");

    await dragAndDrop(resizeHandle, th3);

    const widthsAfterResize = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);

    // 2. Column size should be the same after selecting a row
    await click(target.querySelector("tbody .o_list_record_selector"));
    const widthsAfterSelectRow = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);
    expect(widthsAfterResize[0]).toBe(widthsAfterSelectRow[0], { message: "Width must not have been changed after selecting a row" });
    expect(widthsAfterResize[1]).toBe(widthsAfterSelectRow[1], { message: "Width must not have been changed after selecting a row" });
});

test("list: resize column and toggle check all", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
    });

    // 1. Resize column foo to middle of column int_field.
    const th2 = target.querySelector("th:nth-child(2)");
    const th3 = target.querySelector("th:nth-child(3)");
    const resizeHandle = th2.querySelector(".o_resize");

    await dragAndDrop(resizeHandle, th3);

    const widthsAfterResize = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);

    // 2. Column size should be the same after selecting all
    await click(target.querySelector("thead .o_list_record_selector"));
    const widthsAfterSelectAll = [...target.querySelectorAll(".o_list_table th")].map((th) => th.offsetWidth);
    expect(widthsAfterResize[0]).toBe(widthsAfterSelectAll[0], { message: "Width must not have been changed after selecting all" });
    expect(widthsAfterResize[1]).toBe(widthsAfterSelectAll[1], { message: "Width must not have been changed after selecting all" });
});

test("editable list: resize column headers", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="reference" optional="hide"/>
            </tree>`,
    });

    const originalWidths = [...target.querySelectorAll(".o_list_table th")].map((th) => Math.floor(th.offsetWidth));
    const th = target.querySelector("th:nth-child(2)");
    const resizeHandle = th.querySelector(".o_resize");
    const expectedWidth = Math.floor(originalWidths[1] / 2 + resizeHandle.offsetWidth / 2);
    await dragAndDrop(resizeHandle, th);

    const finalWidths = [...target.querySelectorAll(".o_list_table th")].map((th) => Math.floor(th.offsetWidth));
    expect(finalWidths[0]).toBe(originalWidths[0]);
    assert.ok(Math.abs(finalWidths[1] - expectedWidth) <= 1); // rounding
    expect(finalWidths[2]).toBe(originalWidths[2]);
});

test("editable list: resize column headers (2)", async () => {
    // This test will ensure that, on resize list header,
    // the resized element have the correct size and other elements are not resized
    serverData.models.foo.records[0].foo = "a".repeat(200);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="bar"/>
                <field name="reference" optional="hide"/>
            </tree>`,
    });

    // Target handle
    const th = target.querySelector("th:nth-child(2)");
    const thNext = target.querySelector("th:nth-child(3)");
    const resizeHandle = th.querySelector(".o_resize");
    const nextResizeHandle = thNext.querySelector(".o_resize");
    const thOriginalWidth = th.getBoundingClientRect().width;
    const thNextOriginalWidth = thNext.getBoundingClientRect().width;
    const thExpectedWidth = thOriginalWidth + thNextOriginalWidth;

    await dragAndDrop(resizeHandle, nextResizeHandle);

    const thFinalWidth = th.getBoundingClientRect().width;
    const thNextFinalWidth = thNext.getBoundingClientRect().width;

    assert.ok(Math.abs(Math.floor(thFinalWidth) - Math.floor(thExpectedWidth)) <= 1, `Wrong width on resize (final: ${thFinalWidth}, expected: ${thExpectedWidth})`);
    expect(Math.floor(thNextOriginalWidth)).toBe(Math.floor(thNextFinalWidth), { message: "Width must not have been changed" });
});

test("resize column with several x2many lists in form group", async () => {
    /** @param {number} index */
    const getTableWidth = (index) => Math.floor(target.querySelectorAll(".o_field_x2many_list table")[index].offsetWidth);

    serverData.models.bar.fields.text = { string: "Text field", type: "char" };
    serverData.models.foo.records[0].o2m = [1, 2];

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
            <form>
                <group>
                    <field name="o2m">
                        <tree editable="bottom">
                            <field name="display_name"/>
                            <field name="text"/>
                        </tree>
                    </field>
                    <field name="m2m">
                        <tree editable="bottom">
                            <field name="display_name"/>
                            <field name="text"/>
                        </tree>
                    </field>
                </group>
            </form>`,
        resId: 1,
    });

    const th = target.querySelector("th");
    const resizeHandle = th.querySelector(".o_resize");
    const initialWidths = [getTableWidth(0), getTableWidth(1)];

    expect(initialWidths[0]).toBe(initialWidths[1], { message: "both table columns have same width" });

    await dragAndDrop(resizeHandle, target.getElementsByTagName("th")[1], "right");

    assert.notEqual(initialWidths[0], getTableWidth(0), "first o2m table is resized and width of table has changed");
    expect(initialWidths[1]).toBe(getTableWidth(1), { message: "second o2m table should not be impacted on first o2m in group resized" });
});

test("resize column with x2many list with several fields in form notebook", async () => {
    serverData.models.foo.records[0].o2m = [1, 2];

    await mountView({
        type: "form",
        resModel: "foo",
        arch: `
                <form>
                    <sheet>
                        <notebook>
                            <page string="Page 1">
                                <field name="o2m">
                                    <tree editable="bottom">
                                        <field name="display_name"/>
                                        <field name="display_name"/>
                                        <field name="display_name"/>
                                        <field name="display_name"/>
                                    </tree>
                                </field>
                            </page>
                        </notebook>
                    </sheet>
                </form>`,
        resId: 1,
    });

    const th = target.querySelector("th");
    const resizeHandle = th.querySelector(".o_resize");
    const listInitialWidth = target.querySelector(".o_list_renderer").offsetWidth;

    await dragAndDrop(resizeHandle, target.getElementsByTagName("th")[1], {
        position: "right",
    });

    expect(target.querySelector(".o_list_renderer").offsetWidth).toBe(listInitialWidth, { message: "resizing the column should not impact the width of list" });
});

test("enter edition in editable list with multi_edit = 0", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" multi_edit="0">
                <field name="int_field"/>
            </tree>`,
    });

    // click on int_field cell of first row
    await click(target.querySelector(".o_data_row .o_data_cell"));
    const intFieldInput = target.querySelector(".o_selected_row .o_field_widget[name=int_field] input");
    expect(document.activeElement).toBe(intFieldInput);
});

test("enter edition in editable list with multi_edit = 1", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" multi_edit="1">
                <field name="int_field"/>
            </tree>`,
    });

    // click on int_field cell of first row
    await click(target.querySelector(".o_data_row .o_data_cell"));
    const intFieldInput = target.querySelector(".o_selected_row .o_field_widget[name=int_field] input");
    expect(document.activeElement).toBe(intFieldInput);
});

test("continue creating new lines in editable=top on keyboard nav", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="int_field"/>
            </tree>`,
    });

    const initialRowCount = $(".o_data_cell[name=int_field]").length;

    // click on int_field cell of first row
    await click($(".o_list_button_add:visible").get(0));

    await contains(".o_data_cell[name=int_field] input").edit("1");
    triggerHotkey("Tab");
    await nextTick();

    await contains(".o_data_cell[name=int_field] input").edit("2");
    triggerHotkey("Enter");
    await nextTick();

    // 3 new rows: the two created ("1" and "2", and a new still in edit mode)
    expect($(".o_data_cell[name=int_field]").length).toBe(initialRowCount + 3);
});

test("Date in evaluation context works with date field", async () => {
    patchDate(1997, 0, 9, 12, 0, 0);

    serverData.models.foo.fields.birthday = { string: "Birthday", type: "date" };
    serverData.models.foo.records[0].birthday = "1997-01-08";
    serverData.models.foo.records[1].birthday = "1997-01-09";
    serverData.models.foo.records[2].birthday = "1997-01-10";

    await mountView({
        type: "list",
        arch: `
            <tree>
                <field name="birthday" decoration-danger="birthday > today"/>
            </tree>`,
        resModel: "foo",
    });

    expect(".o_data_row .text-danger").toHaveCount(1);
});

test("Datetime in evaluation context works with datetime field", async () => {
    patchDate(1997, 0, 9, 12, 0, 0);

    /**
     * Returns "1997-01-DD HH:MM:00" with D, H and M holding current UTC values
     * from patched date + (deltaMinutes) minutes.
     * This is done to allow testing from any timezone since UTC values are
     * calculated with the offset of the current browser.
     */
    function dateStringDelta(deltaMinutes) {
        const d = new Date(Date.now() + 1000 * 60 * deltaMinutes);
        return `1997-01-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
    }

    // "datetime" field may collide with "datetime" object in context
    serverData.models.foo.fields.birthday = { string: "Birthday", type: "datetime" };
    serverData.models.foo.records[0].birthday = dateStringDelta(-30);
    serverData.models.foo.records[1].birthday = dateStringDelta(0);
    serverData.models.foo.records[2].birthday = dateStringDelta(+30);

    await mountView({
        type: "list",
        arch: `
            <tree>
                <field name="birthday" decoration-danger="birthday > now"/>
            </tree>`,
        resModel: "foo",
    });

    expect(".o_data_row .text-danger").toHaveCount(1);
});

test("Auto save: add a record and leave action", async () => {
    serverData.actions = {
        1: {
            id: 1,
            name: "Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[2, "list"]],
            search_view_id: [1, "search"],
        },
        2: {
            id: 2,
            name: "Action 2",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [1, "search"],
        },
    };
    serverData.views = {
        "foo,1,search": "<search></search>",
        "foo,2,list": '<tree editable="top"><field name="foo"/></tree>',
        "foo,3,list": '<tree editable="top"><field name="foo"/></tree>',
    };
    const webClient = await createWebClient({ serverData });

    await doAction(webClient, 1);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip"]
    );
    expect(".o_data_row").toHaveCount(4);

    await click($(".o_list_button_add:visible").get(0));
    await editInput(target, '.o_data_cell [name="foo"] input', "test");

    // change action and come back
    await doAction(webClient, 2);
    await doAction(webClient, 1, { clearBreadcrumbs: true });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip", "test"]
    );
    expect(".o_data_row").toHaveCount(5);
});

test("Auto save: create a new record without modifying it and leave action", async () => {
    serverData.models.foo.fields.foo.required = true;
    serverData.actions = {
        1: {
            id: 1,
            name: "Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[2, "list"]],
            search_view_id: [1, "search"],
        },
        2: {
            id: 2,
            name: "Action 2",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [1, "search"],
        },
    };
    serverData.views = {
        "foo,1,search": "<search></search>",
        "foo,2,list": '<tree editable="top"><field name="foo"/></tree>',
        "foo,3,list": '<tree editable="top"><field name="foo"/></tree>',
    };
    const webClient = await createWebClient({ serverData });

    await doAction(webClient, 1);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip"]
    );
    expect(".o_data_row").toHaveCount(4);

    await click($(".o_list_button_add:visible").get(0));
    expect(".o_data_row").toHaveCount(5);

    // change action and come back
    await doAction(webClient, 2);
    await doAction(webClient, 1, { clearBreadcrumbs: true });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip"]
    );
    expect(".o_data_row").toHaveCount(4);
});

test("Auto save: modify a record and leave action", async () => {
    serverData.actions = {
        1: {
            id: 1,
            name: "Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[2, "list"]],
            search_view_id: [1, "search"],
        },
        2: {
            id: 2,
            name: "Action 2",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [1, "search"],
        },
    };
    serverData.views = {
        "foo,1,search": "<search></search>",
        "foo,2,list": '<tree editable="top"><field name="foo"/></tree>',
        "foo,3,list": '<tree editable="top"><field name="foo"/></tree>',
    };
    const webClient = await createWebClient({ serverData });

    await doAction(webClient, 1);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip"]
    );

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="foo"] input', "test");

    // change action and come back
    await doAction(webClient, 2);
    await doAction(webClient, 1, { clearBreadcrumbs: true });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["test", "blip", "gnap", "blip"]
    );
});

test("Auto save: modify a record and leave action (reject)", async () => {
    serverData.actions = {
        1: {
            id: 1,
            name: "Action 1",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[2, "list"]],
            search_view_id: [1, "search"],
        },
        2: {
            id: 2,
            name: "Action 2",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[3, "list"]],
            search_view_id: [1, "search"],
        },
    };
    serverData.views = {
        "foo,1,search": "<search></search>",
        "foo,2,list": '<tree editable="top"><field name="foo" required="1"/></tree>',
        "foo,3,list": '<tree editable="top"><field name="foo"/></tree>',
    };
    const webClient = await createWebClient({ serverData });

    patchWithCleanup(webClient.env.services.notification, {
        add: (message, options) => {
            assert.step(options.title.toString());
            assert.step(message.toString());
        },
    });

    await doAction(webClient, 1);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap", "blip"]
    );

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="foo"] input', "");
    doAction(webClient, 2);
    await nextTick();
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["", "blip", "gnap", "blip"]
    );
    expect("foo").toHaveClass("o_field_invalid");
    expect(".o_data_row").toHaveCount(4);

    assert.verifySteps(["Invalid fields: ", "<ul><li>Foo</li></ul>"]);
});

test("Auto save: add a record and change page", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" limit="3">
                <field name="foo"/>
            </tree>`,
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap"]
    );

    await click($(".o_list_button_add:visible").get(0));
    await editInput(target, '.o_data_cell [name="foo"] input', "test");
    await pagerNext(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["blip", "test"]
    );

    await pagerPrevious(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap"]
    );
});

test("Auto save: modify a record and change page", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" limit="3">
                <field name="foo"/>
            </tree>`,
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap"]
    );

    await click(target.querySelector(".o_data_cell"));
    await contains(".o_data_cell input").edit("test");
    await pagerNext(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["blip"]
    );

    await pagerPrevious(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["test", "blip", "gnap"]
    );
});

test("Auto save: modify a record and change page (reject)", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top" limit="3">
                <field name="foo" required="1"/>
            </tree>`,
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["yop", "blip", "gnap"]
    );

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, ".o_data_cell input", "");
    await pagerNext(target);
    expect("foo").toHaveClass("o_field_invalid");
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_cell")].map((el) => el.textContent),
        ["", "blip", "gnap"]
    );
});

test("Auto save: save on closing tab/browser", async () => {
    assert.expect(3);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
            </tree>`,
        mockRPC(route, { args, method, model }) {
            if (model === "foo" && method === "web_save") {
                assert.step("save"); // should be called
                expect(args).toEqual([[1], { foo: "test" }]);
            }
        },
    });
    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="foo"] input', "test");

    const evnt = new Event("beforeunload");
    evnt.preventDefault = () => assert.step("prevented");
    window.dispatchEvent(evnt);
    await nextTick();
    expect(["save"]).toVerifySteps();
});

test("Auto save: save on closing tab/browser (pending changes)", async () => {
    assert.expect(1);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
            </tree>`,
        mockRPC(route, { args, method, model }) {
            if (model === "foo" && method === "web_save") {
                expect(args).toEqual([[1], { foo: "test" }]);
            }
        },
    });
    await click(target.querySelector(".o_data_cell"));
    const input = target.querySelector('.o_data_cell [name="foo"] input');
    input.value = "test";
    await triggerEvent(input, null, "input");

    window.dispatchEvent(new Event("beforeunload"));
    await nextTick();
});

test("Auto save: save on closing tab/browser (invalid field)", async () => {
    assert.expect(2);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo" required="1"/>
            </tree>`,
        mockRPC(route, { args, method, model }) {
            if (model === "foo" && method === "write") {
                assert.step("save"); // should not be called
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="foo"] input', "");

    const evnt = new Event("beforeunload");
    evnt.preventDefault = () => assert.step("prevented");
    window.dispatchEvent(evnt);
    await nextTick();

    assert.verifySteps(["prevented"], "should not save because of invalid field");
});

test("Auto save: save on closing tab/browser (onchanges + pending changes)", async () => {
    assert.expect(1);

    serverData.models.foo.onchanges = {
        int_field: function (obj) {
            obj.foo = `${obj.int_field}`;
        },
    };

    const def = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="top">
                    <field name="foo"/>
                    <field name="int_field"/>
                </tree>`,
        mockRPC(route, { args, method, model }) {
            if (model === "foo" && method === "onchange") {
                return def;
            }
            if (model === "foo" && method === "web_save") {
                expect(args).toEqual([[1], { int_field: 2021 }]);
            }
        },
    });
    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="int_field"] input', "2021");

    window.dispatchEvent(new Event("beforeunload"));
    await nextTick();
});

test("Auto save: save on closing tab/browser (onchanges)", async () => {
    assert.expect(1);

    serverData.models.foo.onchanges = {
        int_field: function (obj) {
            obj.foo = `${obj.int_field}`;
        },
    };

    const def = makeDeferred();
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        mockRPC(route, { args, method, model }) {
            if (model === "foo" && method === "onchange") {
                return def;
            }
            if (model === "foo" && method === "web_save") {
                expect(args).toEqual([[1], { foo: "test", int_field: 2021 }]);
            }
        },
    });
    await click(target.querySelector(".o_data_cell"));
    await editInput(target, '.o_data_cell [name="int_field"] input', "2021");
    const input = target.querySelector('.o_data_cell [name="foo"] input');
    input.value = "test";
    await triggerEvent(input, null, "input");

    window.dispatchEvent(new Event("beforeunload"));
    await nextTick();
});

test("edition, then navigation with tab (with a readonly re-evaluated field and onchange)", async () => {
    // This test makes sure that if we have a cell in a row that will become
    // read-only after editing another cell, in case the keyboard navigation
    // move over it before it becomes read-only and there are unsaved changes
    // (which will trigger an onchange), the focus of the next activable
    // field will not crash
    serverData.models.bar.onchanges = {
        o2m: function () {},
    };
    serverData.models.bar.fields.o2m = {
        string: "O2M field",
        type: "one2many",
        relation: "foo",
    };
    serverData.models.bar.records[0].o2m = [1, 4];

    await mountView({
        type: "form",
        resModel: "bar",
        resId: 1,
        arch: `
                <form>
                    <group>
                        <field name="display_name"/>
                        <field name="o2m">
                            <tree editable="bottom">
                                <field name="foo"/>
                                <field name="date" readonly="foo != 'yop'"/>
                                <field name="int_field"/>
                            </tree>
                        </field>
                    </group>
                </form>`,
        mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.step(`onchange:${args.model}`);
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    expect(document.activeElement).toBe(target.querySelector(".o_data_cell[name=foo] input"));
    await contains(".o_data_cell[name=foo] input").edit("new value");

    triggerHotkey("Tab");
    await nextTick();

    expect(document.activeElement).toBe(target.querySelector(".o_data_cell[name=int_field] input"));

    expect(["onchange:bar"]).toVerifySteps();
});

test("selecting a row after another one containing a table within an html field should be the correct one", async () => {
    // FIXME WOWL hack: add back the text field as html field removed by web_editor html_field file
    registry.category("fields").add("html", textField, { force: true });
    serverData.models.foo.fields.html = { string: "HTML field", type: "html" };
    serverData.models.foo.records[0].html = `
            <table class="table table-bordered">
                <tbody>
                    <tr>
                        <td><br></td>
                        <td><br></td>
                    </tr>
                        <tr>
                        <td><br></td>
                        <td><br></td>
                    </tr>
                </tbody>
            </table>`;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top" multi_edit="1"><field name="html"/></tree>',
    });

    await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
    assert.ok($("table.o_list_table > tbody > tr:eq(1)")[0].classList.contains("o_selected_row"), "The second row should be selected");
});

test("archive/unarchive not available on active readonly models", async () => {
    serverData.models.foo.fields.active = {
        string: "Active",
        type: "boolean",
        default: true,
        readonly: true,
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree limit="3"><field name="display_name"/></tree>',
        actionMenus: {},
    });

    await click(target.querySelector("tbody .o_data_row td.o_list_record_selector input"));
    expect(".o_cp_action_menus").toHaveCount(1, { message: "sidebar should be available" });

    await contains("div.o_control_panel .o_cp_action_menus .dropdown-toggle").click();
    expect("a:contains(Archive)").toHaveCount(0, { message: "Archive action should not be available" });
});

test("open groups are kept when leaving and coming back", async () => {
    serverData.views = {
        "foo,false,list": `<tree><field name="foo"/></tree>`,
        "foo,false,search": "<search/>",
        "foo,false,form": "<form/>",
    };
    const webClient = await createWebClient({ serverData });
    await doAction(webClient, {
        name: "Partners",
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [false, "list"],
            [false, "form"],
        ],
        context: {
            group_by: ["bar"],
        },
    });

    expect(".o_list_view").toHaveCount(1);
    expect(".o_group_header").toHaveCount(2);
    expect(".o_group_open").toHaveCount(0);
    expect(".o_data_row").toHaveCount(0);

    // unfold the second group
    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(".o_group_open").toHaveCount(1);
    expect(".o_data_row").toHaveCount(3);

    // open a record and go back
    await click(target.querySelector(".o_data_cell"));
    expect(".o_form_view").toHaveCount(1);
    await click(target.querySelector(".breadcrumb-item a"));

    expect(".o_group_open").toHaveCount(1);
    expect(".o_data_row").toHaveCount(3);
});

test("open groups are kept when leaving and coming back (grouped by date)", async () => {
    serverData.models.foo.fields.date.default = "2022-10-10";
    serverData.views = {
        "foo,false,list": `<tree><field name="foo"/></tree>`,
        "foo,false,search": "<search/>",
        "foo,false,form": "<form/>",
    };
    const webClient = await createWebClient({ serverData });
    await doAction(webClient, {
        name: "Partners",
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [false, "list"],
            [false, "form"],
        ],
        context: {
            group_by: ["date"],
        },
    });

    expect(".o_list_view").toHaveCount(1);
    expect(".o_group_header").toHaveCount(2);
    expect(".o_group_open").toHaveCount(0);
    expect(".o_data_row").toHaveCount(0);

    // unfold the second group
    await click(target.querySelectorAll(".o_group_header")[1]);
    expect(".o_group_open").toHaveCount(1);
    expect(".o_data_row").toHaveCount(3);

    // open a record and go back
    await click(target.querySelector(".o_data_cell"));
    expect(".o_form_view").toHaveCount(1);
    await click(target.querySelector(".breadcrumb-item a"));

    expect(".o_group_open").toHaveCount(1);
    expect(".o_data_row").toHaveCount(3);
});

test("go to the next page after leaving and coming back to a grouped list view", async () => {
    serverData.views = {
        "foo,false,list": `<tree groups_limit="1"><field name="foo"/></tree>`,
        "foo,false,search": "<search/>",
        "foo,false,form": "<form/>",
    };
    const webClient = await createWebClient({ serverData });
    await doAction(webClient, {
        name: "Partners",
        res_model: "foo",
        type: "ir.actions.act_window",
        views: [
            [false, "list"],
            [false, "form"],
        ],
        context: {
            group_by: ["bar"],
        },
    });
    expect(".o_list_view").toHaveCount(1);
    expect(".o_group_header").toHaveCount(1);
    expect(target.querySelector(".o_group_header").textContent).toBe("No (1) ");

    // unfold the second group
    await contains(".o_group_header").click();
    expect(".o_group_open").toHaveCount(1);
    expect(".o_data_row").toHaveCount(1);

    // open a record and go back
    await click(target.querySelector(".o_data_cell"));
    expect(".o_form_view").toHaveCount(1);

    await click(target.querySelector(".breadcrumb-item a"));
    expect(".o_group_header").toHaveCount(1);
    expect(target.querySelector(".o_group_header").textContent).toBe("No (1) ");

    await pagerNext(target);
    expect(".o_group_header").toHaveCount(1);
    expect(target.querySelector(".o_group_header").textContent).toBe("Yes (3) ");
});

test("keep order after grouping", async () => {
    serverData.models.foo.fields.foo.sortable = true;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <field name="foo"/>
            </tree>`,
        searchViewArch: `
            <search>
                <filter name="group_by_foo" string="Foo" context="{'group_by':'foo'}"/>
            </search>`,
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row td[name=foo]")].map((r) => r.innerText),
        ["yop", "blip", "gnap", "blip"]
    );

    // Descending order on Bar
    await contains("th.o_column_sortable[data-name=foo]").click();
    await contains("th.o_column_sortable[data-name=foo]").click();

    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row td[name=foo]")].map((r) => r.innerText),
        ["yop", "gnap", "blip", "blip"]
    );

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Foo");

    assert.deepEqual(
        [...target.querySelectorAll(".o_group_name")].map((r) => r.innerText),
        ["yop (1)", "gnap (1)", "blip (2)"]
    );

    await toggleMenuItem(target, "Foo");

    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row td[name=foo]")].map((r) => r.innerText),
        ["yop", "gnap", "blip", "blip"]
    );
});

test("editable list header click should unselect record", async () => {
    await mountView({
        resModel: "foo",
        type: "list",
        arch: `<list editable="top"><field name="display_name" /></list>`,
        serverData,
    });

    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);
    await contains(".o_data_cell input").edit("someInput");
    await click(target.querySelector("thead th:nth-child(2)"));
    await triggerEvent(target.querySelector("thead th"), null, "keydown", { key: "ArrowDown" });

    expect(".o_selected_row").toHaveCount(0);
});

test("editable list group header click should unselect record", async () => {
    await mountView({
        resModel: "foo",
        type: "list",
        arch: `<list editable="top"><field name="display_name" /></list>`,
        groupBy: ["bar"],
    });

    await click(target.querySelector(".o_group_header"));
    await click(target.querySelector(".o_group_header:not(.o_group_open)"));

    await click(target.querySelector(".o_data_cell"));
    expect(".o_selected_row").toHaveCount(1);
    await contains(".o_data_cell input").edit("someInput");
    await click(target.querySelectorAll(".o_group_header")[1]);

    expect(".o_selected_row").toHaveCount(0);
});

test("renders banner_route", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree banner_route="/mybody/isacage">
                <field name="foo"/>
            </tree>`,
        async mockRPC(route) {
            if (route === "/mybody/isacage") {
                assert.step(route);
                return { html: `<div class="setmybodyfree">myBanner</div>` };
            }
        },
    });

    expect(["/mybody/isacage"]).toVerifySteps();
    expect(".setmybodyfree").toHaveCount(1);
});

test("fieldDependencies support for fields", async () => {
    serverData.models.foo.records = [{ id: 1, int_field: 2 }];

    const customField = {
        component: class CustomField extends Component {
            static template = xml`<span t-esc="props.record.data.int_field"/>`;
            static props = ["*"];
        },
        fieldDependencies: [{ name: "int_field", type: "integer" }],
    };
    registry.category("fields").add("custom_field", customField);

    await mountView({
        resModel: "foo",
        type: "list",
        arch: `
            <list>
                <field name="foo" widget="custom_field"/>
            </list>
        `,
        serverData,
    });

    expect(target.querySelector("[name=foo] span").innerText).toBe("2");
});

test("fieldDependencies support for fields: dependence on a relational field", async () => {
    const customField = {
        component: class CustomField extends Component {
            static template = xml`<span t-esc="props.record.data.m2o[0]"/>`;
            static props = ["*"];
        },
        fieldDependencies: [{ name: "m2o", type: "many2one", relation: "bar" }],
    };
    registry.category("fields").add("custom_field", customField);

    await mountView({
        resModel: "foo",
        type: "list",
        arch: `
                <list>
                    <field name="foo" widget="custom_field"/>
                </list>
            `,
        mockRPC: (route, args) => {
            assert.step(args.method);
        },
    });

    expect(target.querySelector("[name=foo] span").innerText).toBe("1");
    expect(["get_views", "web_search_read"]).toVerifySteps();
});

test("editable list correctly saves dirty fields ", async () => {
    serverData.models.foo.records = [serverData.models.foo.records[0]];

    await mountView({
        resModel: "foo",
        type: "list",
        arch: `<list editable="bottom">
                <field name="display_name" />
            </list>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
                expect(args.args).toEqual([[1], { display_name: "test" }]);
            }
        },
    });

    await click(target.querySelector(".o_data_cell"));
    const input = target.querySelector(".o_data_cell input");
    input.value = "test";
    await triggerEvent(input, null, "input");
    triggerHotkey("Tab");
    await nextTick();

    expect(["web_save"]).toVerifySteps();
});

test("edit a field with a slow onchange in a new row", async () => {
    serverData.models.foo.onchanges = {
        int_field: function () {},
    };
    serverData.models.foo.records = [];

    let def;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="int_field"/>
            </tree>`,
        async mockRPC(route, args) {
            assert.step(args.method);
            if (args.method === "onchange") {
                await Promise.resolve(def);
            }
        },
    });

    expect(["get_views", "web_search_read"]).toVerifySteps();

    const value = "14";
    // add a new line
    await click($(".o_list_button_add:visible").get(0));

    expect(["onchange"]).toVerifySteps();

    // we want to add a delay to simulate an onchange
    def = makeDeferred();

    // write something in the field
    await editInput(target, "[name=int_field] input", value);
    expect(target.querySelector("[name=int_field] input").value).toBe(value);

    await contains(".o_list_view").click();

    // check that nothing changed before the onchange finished
    expect(target.querySelector("[name=int_field] input").value).toBe(value);
    expect(["onchange"]).toVerifySteps();

    // unlock onchange
    def.resolve();
    await nextTick();

    // check the current line is added with the correct content
    expect(target.querySelector(".o_data_row [name=int_field]").innerText).toBe(value);
    expect(["web_save"]).toVerifySteps();
});

test("create a record with the correct context", async () => {
    serverData.models.foo.fields.text.required = true;
    serverData.models.foo.records = [];

    await mountView({
        resModel: "foo",
        type: "list",
        arch: ` <list editable="bottom">
                    <field name="display_name"/>
                    <field name="text"/>
                </list>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
                const { context } = args.kwargs;
                expect(context.default_text).toBe("yop");
                expect(context.test).toBe(true);
            }
        },
        context: {
            default_text: "yop",
            test: true,
        },
    });
    await click($(".o_list_button_add:visible").get(0));
    await contains("[name='display_name'] input").edit("blop");
    expect(".o_selected_row").toHaveCount(1);

    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(0);

    expect([...target.querySelectorAll(".o_data_row .o_data_cell")].map((el) => el.textContent)[("blop").toEqual("yop")]);

    expect(["web_save"]).toVerifySteps();
});

test("create a record with the correct context in a group", async () => {
    serverData.models.foo.fields.text.required = true;

    await mountView({
        resModel: "foo",
        type: "list",
        arch: ` <list editable="bottom">
                    <field name="display_name"/>
                    <field name="text"/>
                </list>`,
        groupBy: ["bar"],
        mockRPC(route, args) {
            if (args.method === "web_save") {
                assert.step("web_save");
                const { context } = args.kwargs;
                expect(context.default_bar).toBe(true);
                expect(context.default_text).toBe("yop");
                expect(context.test).toBe(true);
            }
        },
        context: {
            default_text: "yop",
            test: true,
        },
    });
    await click(target.querySelectorAll(".o_group_name")[1]);

    await click(target.querySelector(".o_group_field_row_add a"));
    await contains("[name='display_name'] input").edit("blop");
    expect(".o_selected_row").toHaveCount(1);

    await contains(".o_list_view").click();
    expect(".o_selected_row").toHaveCount(0);

    expect([...target.querySelectorAll(".o_data_row .o_data_cell")].map((el) => el.textContent)[("blop").toEqual("yop")]);

    expect(["web_save"]).toVerifySteps();
});

test("classNames given to a field are set on the right field directly", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field class="d-flex align-items-center" name="int_field" widget="progressbar" options="{'editable': true}" />
                <field class="d-none" name="bar" />
            </tree>`,
    });
    expect(".o_field_cell").not.toHaveClass("d-flex align-items-center", { message: "classnames are not set on the first cell" });
    expect(".o_field_progressbar").toHaveClass("d-flex align-items-center", { message: "classnames are set on the corresponding field div directly" });
    expect(".o_field_cell").toHaveClass("d-none", { message: "classnames are set on the second cell" });
});

test("use a filter_domain in a list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="m2o"/></tree>',
        searchViewArch: `
            <search>
                <field name="m2o" filter_domain="[('m2o', 'child_of', raw_value)]"/>
            </search>`,
        context: {
            search_default_m2o: 1,
        },
    });

    expect(".o_data_row").toHaveCount(3);
});

test("Formatted group operator", async () => {
    serverData.models.foo.records[0].qux = 0.4;
    serverData.models.foo.records[1].qux = 0.2;
    serverData.models.foo.records[2].qux = 0.01;
    serverData.models.foo.records[3].qux = 0.48;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="qux" widget="percentage"/></tree>',
        groupBy: ["bar"],
    });
    const [td1, td2] = target.querySelectorAll("td.o_list_number");
    expect(td1.textContent).toBe("48%");
    expect(td2.textContent).toBe("61%");
});

test("Formatted group operator with digit precision on the field definition", async () => {
    serverData.models.foo.fields.qux.digits = [16, 3];
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="qux"/></tree>',
        groupBy: ["bar"],
    });
    const [td1, td2] = target.querySelectorAll("td.o_list_number");
    expect(td1.textContent).toBe("9.000");
    expect(td2.textContent).toBe("10.400");
});

test("list view does not crash when clicked button cell", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <button name="a" type="object" icon="fa-car"/>
            </tree>
        `,
    });

    expect(".o_data_row:first-child td.o_list_button").toHaveCount(1);
    await contains(".o_data_row:first-child td.o_list_button").click();
});

test("group by going to next page then back to first", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree groups_limit="1"><field name="foo"/><field name="bar"/></tree>',
        groupBy: ["bar"],
    });

    expect([...getPagerValue(target), getPagerLimit(target)]).toEqual([1, 2]);
    await pagerNext(target);
    expect([...getPagerValue(target), getPagerLimit(target)]).toEqual([2, 2]);
    await pagerPrevious(target);
    expect([...getPagerValue(target), getPagerLimit(target)]).toEqual([1, 2]);
});

test("sort on a non sortable field with allow_order option", async () => {
    serverData.models.foo.records = [{ bar: true }, { bar: false }, { bar: true }];

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <list>
                <field name="bar" options="{ 'allow_order': true }"/>
            </list>
        `,
    });

    assert.deepEqual(
        [...target.querySelectorAll("[name=bar] input")].map((el) => el.checked),
        [true, false, true]
    );
    expect("th[data-name=bar]").toHaveClass("o_column_sortable");
    expect("th[data-name=bar]").not.toHaveClass("table-active");

    await contains("th[data-name=bar]").click();

    assert.deepEqual(
        [...target.querySelectorAll("[name=bar] input")].map((el) => el.checked),
        [false, true, true]
    );
    expect("th[data-name=bar]").toHaveClass("o_column_sortable");
    expect("th[data-name=bar]").toHaveClass("table-active");
    expect("th[data-name=bar] i").toHaveClass("fa-angle-up");
});

test("sort rows in a grouped list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <list>
                <field name="int_field"/>
            </list>`,
        groupBy: ["bar"],
    });

    await click(target.querySelectorAll(".o_group_header")[1]);

    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell"))).toEqual(["10", "9", "17"]);
    expect("th[data-name=int_field]").toHaveClass("o_column_sortable");

    await contains("th[data-name=int_field]").click();

    expect(getNodesTextContent(target.querySelectorAll(".o_data_cell"))).toEqual(["9", "10", "17"]);
    expect("th[data-name=int_field]").toHaveClass("o_column_sortable");
    expect("th[data-name=int_field] i").toHaveClass("fa-angle-up");
});

test("have some records, then go to next page in pager then group by some field: at least one group should be visible", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <list limit="2">
                    <field name="foo"/>
                    <field name="bar"/>
                </list>
            `,
        searchViewArch: `
                <search>
                    <filter name="group_by_bar" string="Bar" context="{ 'group_by': 'bar' }"/>
                </search>
            `,
    });
    expect("tbody .o_data_row").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll("tbody .o_data_row")].map((el) => el.innerText.trim()),
        ["yop", "blip"]
    );

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Bar");
    expect("tbody .o_group_header").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll("tbody .o_group_header")].map((el) => el.innerText.trim()),
        ["No (1)", "Yes (3)"]
    );

    await removeFacet(target);
    expect("tbody .o_data_row").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll("tbody .o_data_row")].map((el) => el.innerText.trim()),
        ["yop", "blip"]
    );

    await pagerNext(target);
    expect("tbody .o_data_row").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll("tbody .o_data_row")].map((el) => el.innerText.trim()),
        ["gnap", "blip"]
    );

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "Bar");
    expect("tbody .o_group_header").toHaveCount(2);
    assert.deepEqual(
        [...target.querySelectorAll("tbody .o_group_header")].map((el) => el.innerText.trim()),
        ["No (1)", "Yes (3)"]
    );
});

test("optional field selection do not unselect current row", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="top">
                    <field name="text" optional="hide"/>
                    <field name="foo" optional="show"/>
                    <field name="bar" optional="hide"/>
                </tree>`,
    });

    await clickAdd();

    expect(".o_selected_row").toHaveCount(1);
    expect("div[name=foo] input:focus").toHaveCount(1);

    await contains("table .o_optional_columns_dropdown .dropdown-toggle").click();

    expect(".o_selected_row").toHaveCount(1);
    expect("div[name=foo] input:focus").toHaveCount(1);

    await contains(".o-dropdown--menu span.dropdown-item:nth-child(3) label").click();

    expect(".o_selected_row").toHaveCount(1);
    expect("div[name=foo] input:focus").toHaveCount(1);
    expect(".o_selected_row div[name=bar]").toHaveCount(1);

    await contains(".o-dropdown--menu span.dropdown-item:nth-child(1) label").click();

    expect(".o_selected_row").toHaveCount(1);
    // This below would be better if it still focused foo, but it is an acceptable tradeoff.
    expect("div[name=text] textarea:focus").toHaveCount(1);
    expect(".o_selected_row div[name=text]").toHaveCount(1);
});

test("view widgets are rendered in list view", async () => {
    class TestWidget extends Component {
        static template = xml`<div class="test_widget" t-esc="props.record.data.bar"/>`;
        static props = ["*"];
    }
    const testWidget = {
        component: TestWidget,
    };
    registry.category("view_widgets").add("test_widget", testWidget);
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <list>
                <field name="bar" column_invisible="1"/>
                <widget name="test_widget"/>
            </list>
        `,
    });
    expect("td .test_widget").toHaveCount(4, { message: "there should be one widget (inside td) per record" });
    assert.deepEqual(
        [...target.querySelectorAll(".test_widget")].map((w) => w.textContent),
        ["true", "true", "true", "false"],
        "the widget has access to the record's data"
    );
});

test("edit a record then select another record with a throw error when saving", async () => {
    serviceRegistry.add("error", errorService);

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
                <tree editable="bottom">
                    <field name="foo"/>
                </tree>`,
        mockRPC(route, args) {
            if (args.method === "web_save") {
                throw makeServerError({ message: "Can't write" });
            }
        },
    });

    await click(target.querySelectorAll(".o_data_cell")[1]);
    await contains("[name='foo'] input").edit("plop");
    expect("[name='foo'] input").toHaveCount(1);

    await click(queryFirst(".o_data_cell"));
    await nextTick();
    expect(".o_error_dialog").toHaveCount(1);

    await contains(".o_error_dialog .btn-primary.o-default-button").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row").toHaveClass("o_selected_row");

    await click(queryFirst(".o_data_cell"));
    await nextTick();
    expect(".o_error_dialog").toHaveCount(1);

    await contains(".o_error_dialog .btn-primary.o-default-button").click();
    expect(".o_selected_row").toHaveCount(1);
    expect(".o_data_row").toHaveClass("o_selected_row");
});

test("no highlight of a (sortable) column without label", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree default_order="foo">
                <field name="foo" nolabel="1"/>
                <field name="bar"/>
            </tree>
        `,
    });
    expect("thead th[data-name=foo]").toHaveCount(1);
    expect("thead th[data-name=foo]").not.toHaveClass("table-active");
});

test("highlight of a (sortable) column with label", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree default_order="foo">
                <field name="foo"/>
            </tree>
        `,
    });
    expect("thead th[data-name=foo]").toHaveCount(1);
    expect("thead th[data-name=foo]").toHaveClass("table-active");
});

test("Search more in a many2one", async () => {
    serverData.views = {
        "bar,false,list": `
            <list>
                <field name="display_name"/>
            </list>
        `,
        "bar,false,search": `<search/>`,
    };

    patchWithCleanup(browser, {
        setTimeout: () => {},
    });

    patchWithCleanup(Many2XAutocomplete.defaultProps, {
        searchLimit: 1,
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
            </tree>
        `,
        mockRPC(_, args) {
            if (args.method === "web_read") {
                assert.step(`web_read ${args.args[0]}`);
            } else if (args.method === "web_save") {
                assert.step(`web_save ${args.args[0]}`);
            }
        },
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row td[name=m2o]")].map((el) => el.innerText),
        ["Value 1", "Value 2", "Value 1", "Value 1"]
    );

    await contains(".o_data_row:nth-child(1) td.o_list_many2one").click();
    await contains(".o_field_many2one_selection .o-autocomplete--input").click();
    await clickOpenedDropdownItem(target, "m2o", "Search More...");

    expect([]).toVerifySteps();

    await contains(".modal .o_data_row:nth-child(3) td[name=display_name]").click();

    expect(["web_read 3"]).toVerifySteps();

    await clickSave(target);
    assert.deepEqual(
        [...target.querySelectorAll(".o_data_row td[name=m2o]")].map((el) => el.innerText),
        ["Value 3", "Value 2", "Value 1", "Value 1"]
    );
    expect(["web_save 1"]).toVerifySteps();
});

test("view's context is passed down as evalContext", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        context: {
            default_global_key: "some_value",
        },
        arch: `
            <tree editable="bottom">
                <field name="m2o" domain="[['someField', '=', context.get('default_global_key', 'nope')]]"/>
            </tree>
        `,
        mockRPC(_, args) {
            if (args.method === "name_search") {
                assert.step(`name_search`);
                expect(args.kwargs.args).toEqual([["someField", "=", "some_value"]]);
            }
        },
    });

    await contains(".o_data_row:nth-child(1) td.o_list_many2one").click();
    await contains(".o_field_many2one_selection .o-autocomplete--input").click();
    expect(["name_search"]).toVerifySteps();
});

test("list view with default_group_by", async () => {
    serverData.models.foo.fields.m2m.groupable = true;

    let readGroupCount = 0;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree default_group_by="bar">
                <field name="bar"/>
            </tree>
        `,
        async mockRPC(route, { kwargs }) {
            if (route === "/web/dataset/call_kw/partner/web_read_group") {
                readGroupCount++;
                switch (readGroupCount) {
                    case 1:
                        return expect(kwargs.groupby).toEqual(["bar"]);
                    case 2:
                        return expect(kwargs.groupby).toEqual(["m2m"]);
                    case 3:
                        return expect(kwargs.groupby).toEqual(["bar"]);
                }
            }
        },
    });

    expect(".o_list_renderer table").toHaveClass("o_list_table_grouped");
    expect(".o_group_header").toHaveCount(2);

    await groupByMenu(target, "m2m");
    expect(".o_group_header").toHaveCount(4);

    await toggleMenuItem(target, "M2M field");
    expect(".o_group_header").toHaveCount(2);
});

test("ungrouped list, apply filter, decrease limit", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree limit="4"><field name="foo"/></tree>`,
        searchViewArch: `
            <search>
                <filter name="my_filter" string="My Filter" domain="[('id', '>', 1)]"/>
            </search>`,
    });

    expect(".o_data_row").toHaveCount(4);

    // apply the filter to trigger a reload of datapoints
    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "My Filter");

    expect(".o_data_row").toHaveCount(3);

    // edit the pager with a smaller limit
    await click(target.querySelector(".o_pager_value"));
    await contains(".o_pager_value").edit("1-2");

    expect(".o_data_row").toHaveCount(2);
});

test("Properties: char", async () => {
    const definition = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "CHAR" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: "TEST" }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_char']").textContent).toBe("Property char");
    expect(".o_field_cell.o_char_cell").toHaveCount(3);
    expect(target.querySelector(".o_field_cell.o_char_cell").textContent).toBe("CHAR");

    await click(target.querySelector(".o_field_cell.o_char_cell"));
    await contains(".o_field_cell.o_char_cell input").edit("TEST");
    expect(target.querySelector(".o_field_cell.o_char_cell input").value).toBe("TEST");

    await click(target.querySelector("[name='m2o']"));
    expect(target.querySelector(".o_field_cell.o_char_cell input").value).toBe("TEST");

    await clickSave(target);
    expect(target.querySelector(".o_field_cell.o_char_cell").textContent).toBe("TEST");
});

test("Properties: boolean", async () => {
    const definition = {
        type: "boolean",
        name: "property_boolean",
        string: "Property boolean",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: true }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: false }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_boolean']").textContent).toBe("Property boolean");
    expect(".o_field_cell.o_boolean_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_boolean_cell"));
    await click(target.querySelector(".o_field_cell.o_boolean_cell input"));
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_boolean_cell input").checked).toBe(false);
});

test("Properties: integer", async () => {
    const definition = {
        type: "integer",
        name: "property_integer",
        string: "Property integer",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: 123 }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: 321 }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_integer']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_integer']").textContent).toBe("Property integer");
    expect(".o_field_cell.o_integer_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_integer_cell"));
    await editInput(target, ".o_field_cell.o_integer_cell input", 321);
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_integer_cell").textContent).toBe("321");
    expect(target.querySelector(".o_list_footer .o_list_number").textContent).toBe("567", { message: "First property is 321, second is zero because it has a different parent and the 2 others are 123 so the total should be 321 + 123 * 2 = 567" });
});

test("Properties: float", async () => {
    const definition = {
        type: "float",
        name: "property_float",
        string: "Property float",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: record.id === 4 ? false : 123.45 }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: 3.21 }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_float']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_float']").textContent).toBe("Property float");
    expect(".o_field_cell.o_float_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_float_cell"));
    await editInput(target, ".o_field_cell.o_float_cell input", 3.21);
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_float_cell").textContent).toBe("3.21");
    expect(target.querySelector(".o_list_footer .o_list_number").textContent).toBe("126.66", { message: "First property is 3.21, second is zero because it has a different parent the other is 123.45 and the last one zero because it is false so the total should be 3.21 + 123.45 = 126.66" });
});

test("Properties: date", async () => {
    const definition = {
        type: "date",
        name: "property_date",
        string: "Property date",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "2022-12-12" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: "2022-12-19" }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_date']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_date']").textContent).toBe("Property date");
    expect(".o_field_cell.o_date_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_date_cell"));
    await contains(".o_field_date input").click();
    await click(getPickerCell("19"));
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_date_cell").textContent).toBe("12/19/2022");
});

test("Properties: datetime", async () => {
    patchTimeZone(0);
    const definition = {
        type: "datetime",
        name: "property_datetime",
        string: "Property datetime",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "2022-12-12 12:12:00" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: "2022-12-19 12:12:00" }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_datetime']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_datetime']").textContent).toBe("Property datetime");
    expect(".o_field_cell.o_datetime_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_datetime_cell"));
    await contains(".o_field_datetime input").click();
    await click(getPickerCell("19"));
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_datetime_cell").textContent).toBe("12/19/2022 12:12:00");
});

test("Properties: selection", async () => {
    const definition = {
        type: "selection",
        name: "property_selection",
        string: "Property selection",
        selection: [
            ["a", "A"],
            ["b", "B"],
            ["c", "C"],
        ],
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "b" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: "a" }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_selection']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_selection']").textContent).toBe("Property selection");
    expect(".o_field_cell.o_selection_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_selection_cell"));
    await editSelect(target, ".o_field_cell.o_selection_cell select", `"a"`);
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_selection_cell").textContent).toBe("A");
});

test("Properties: tags", async () => {
    const definition = {
        type: "tags",
        name: "property_tags",
        string: "Property tags",
        tags: [
            ["a", "A", 1],
            ["b", "B", 2],
            ["c", "C", 3],
        ],
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: ["a", "c"] }];
        }
    }

    let expectedValue = null;

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: expectedValue }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_tags']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_tags']").textContent).toBe("Property tags");
    expect(".o_field_cell.o_property_tags_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_property_tags_cell"));
    await click(queryFirst(".o_field_cell.o_property_tags_cell .o_delete"));
    expectedValue = ["c"];
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_property_tags_cell").textContent).toBe("C");

    await click(target.querySelector(".o_field_cell.o_property_tags_cell"));
    await selectDropdownItem(target, "properties.property_tags", "B");
    expectedValue = ["c", "b"];
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_property_tags_cell").textContent).toBe("BC");
});

test("Properties: many2one", async () => {
    const definition = {
        type: "many2one",
        name: "property_many2one",
        string: "Property many2one",
        comodel: "res_currency",
        domain: "[]",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: [1, "USD"] }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: [2, "EUR"] }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_many2one']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_many2one']").textContent).toBe("Property many2one");
    expect(".o_field_cell.o_many2one_cell").toHaveCount(3);

    await click(target.querySelector(".o_field_cell.o_many2one_cell"));
    await selectDropdownItem(target, "properties.property_many2one", "EUR");
    await clickSave(target);

    expect(target.querySelector(".o_field_cell.o_many2one_cell").textContent).toBe("EUR");
});

test("Properties: many2many", async () => {
    const definition = {
        type: "many2many",
        name: "property_many2many",
        string: "Property many2many",
        comodel: "res_currency",
        domain: "[]",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: [[1, "USD"]] }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route, { method, args }) {
            if (method === "write") {
                expect(args).toEqual([[1], { properties: [{ ...definition, value: [] }] }]);
            }
        },
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await contains(".o-dropdown--menu input[type='checkbox']").click();

    expect(".o_list_renderer th[data-name='properties.property_many2many']").toHaveCount(1);
    expect(target.querySelector(".o_list_renderer th[data-name='properties.property_many2many']").textContent).toBe("Property many2many");
    expect(".o_field_cell.o_many2many_tags_cell").toHaveCount(3);
});

test("multiple sources of properties definitions", async () => {
    const definition0 = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    const definition1 = {
        type: "boolean",
        name: "property_boolean",
        string: "Property boolean",
    };
    serverData.models.bar.records[0].definitions = [definition0];
    serverData.models.bar.records[1].definitions = [definition1];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition0, value: "0" }];
        } else if (record.m2o === 2) {
            record.properties = [{ ...definition1, value: true }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
    });

    await contains(".o_optional_columns_dropdown_toggle").click();
    await click(queryFirst(".o-dropdown--menu input[type='checkbox']"));
    await click(target.querySelectorAll(".o-dropdown--menu input[type='checkbox']")[1]);

    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(1);
    expect(".o_field_cell.o_char_cell").toHaveCount(3);

    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(1);
    assert.containsOnce(target, ".o_field_cell.o_boolean_cell", 1);
});

test("toggle properties", async () => {
    const definition0 = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    const definition1 = {
        type: "boolean",
        name: "property_boolean",
        string: "Property boolean",
    };
    serverData.models.bar.records[0].definitions = [definition0];
    serverData.models.bar.records[1].definitions = [definition1];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition0, value: "0" }];
        } else if (record.m2o === 2) {
            record.properties = [{ ...definition1, value: true }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
    });

    await contains(".o_optional_columns_dropdown_toggle").click();

    await click(queryFirst(".o-dropdown--menu input[type='checkbox']"));
    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(1);
    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(0);

    await click(target.querySelectorAll(".o-dropdown--menu input[type='checkbox']")[1]);
    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(1);
    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(1);

    await click(queryFirst(".o-dropdown--menu input[type='checkbox']"));
    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(0);
    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(1);

    await click(target.querySelectorAll(".o-dropdown--menu input[type='checkbox']")[1]);
    expect(".o_list_renderer th[data-name='properties.property_char']").toHaveCount(0);
    expect(".o_list_renderer th[data-name='properties.property_boolean']").toHaveCount(0);
});

test("properties: optional show/hide (no config in local storage)", async () => {
    const definition = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "0" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties"/>
            </tree>`,
    });

    expect(".o_list_table thead th").toHaveCount(3);
    expect(".o_list_table thead th.o_list_record_selector").toHaveCount(1);
    expect(".o_list_table thead th[data-name=m2o]").toHaveCount(1);
    expect(".o_list_table thead th.o_list_actions_header").toHaveCount(1);
});

test("properties: optional show/hide (config from local storage)", async () => {
    const definition = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "0" }];
        }
    }

    patchWithCleanup(browser.localStorage, {
        getItem(key) {
            return "properties.property_char";
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties"/>
            </tree>`,
    });

    expect(".o_list_table thead th").toHaveCount(4);
    expect(".o_list_table thead th.o_list_record_selector").toHaveCount(1);
    expect(".o_list_table thead th[data-name=m2o]").toHaveCount(1);
    expect(".o_list_table thead th[data-name='properties.property_char']").toHaveCount(1);
    expect(".o_list_table thead th.o_list_actions_header").toHaveCount(1);
});

test("properties: optional show/hide (at reload, config from local storage)", async () => {
    const definition = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: "0" }];
        }
    }

    patchWithCleanup(browser.localStorage, {
        getItem(key) {
            return "properties.property_char";
        },
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties"/>
            </tree>`,
        groupBy: ["m2o"],
    });

    // list is grouped, no record displayed
    expect(".o_group_header").toHaveCount(2);
    expect(".o_data_row").toHaveCount(0);

    expect(".o_list_table thead th").toHaveCount(2);
    expect(".o_list_table thead th.o_list_record_selector").toHaveCount(1);
    expect(".o_list_table thead th[data-name=m2o]").toHaveCount(1);

    await click(target.querySelector(".o_group_header")); // open group Value 1

    expect(".o_data_row").toHaveCount(3);
    expect(".o_list_table thead th").toHaveCount(4);
    expect(".o_list_table thead th.o_list_record_selector").toHaveCount(1);
    expect(".o_list_table thead th[data-name=m2o]").toHaveCount(1);
    expect(".o_list_table thead th[data-name='properties.property_char']").toHaveCount(1);
    expect(".o_list_table thead th.o_list_actions_header").toHaveCount(1);
});

test("reload properties definitions when domain change", async () => {
    const definition0 = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition0];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition0, value: "AA" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route) {
            assert.step(route);
        },
        irFilters: [
            {
                context: "{}",
                domain: "[['id', '=', 1]]",
                id: 7,
                name: "only one",
                sort: "[]",
                user_id: [2, "Mitchell Admin"],
            },
        ],
    });

    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();

    await toggleSearchBarMenu(target);
    await toggleMenuItem(target, "only one");

    expect(["/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
});

test("do not reload properties definitions when page change", async () => {
    const definition0 = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition0];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition0, value: "0" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom" limit="2">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route) {
            assert.step(route);
        },
    });

    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();

    await pagerNext(target);

    expect(["/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
});

test("load properties definitions only once when grouped", async () => {
    const definition0 = {
        type: "char",
        name: "property_char",
        string: "Property char",
    };
    serverData.models.bar.records[0].definitions = [definition0];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition0, value: "0" }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" />
            </tree>
        `,
        mockRPC(route) {
            assert.step(route);
        },
        groupBy: ["m2o"],
    });

    expect(["/web/dataset/call_kw/foo/get_views", "/web/dataset/call_kw/foo/web_read_group"]).toVerifySteps();

    await click(target.querySelector(".o_group_header"));
    expect(["/web/dataset/call_kw/foo/web_search_read"]).toVerifySteps();
});

test("Invisible Properties", async () => {
    const definition = {
        type: "integer",
        name: "property_integer",
        string: "Property integer",
    };
    serverData.models.bar.records[0].definitions = [definition];
    for (const record of serverData.models.foo.records) {
        if (record.m2o === 1) {
            record.properties = [{ ...definition, value: 123 }];
        }
    }

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="bottom">
                <field name="m2o"/>
                <field name="properties" column_invisible="1"/>
            </tree>
        `,
        mockRPC(route, { method, args }) {
            assert.step(method);
        },
    });

    expect(".o_optional_columns_dropdown_toggle").toHaveCount(0);
    expect(["get_views", "web_search_read"]).toVerifySteps();
});

test("header buttons in list view", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree>
                <header>
                    <button name="a" type="object" string="Confirm" confirm="Are you sure?" />
                </header>
                <field name="foo"/>
                <field name="bar" />
            </tree>`,

        mockRPC: async (route, args) => {
            if (route.startsWith("/web/dataset/call_button")) {
                assert.step(args.method);
                return true;
            }
        },
    });
    await click(target.querySelector(".o_data_row .o_list_record_selector input"));
    await click(target.querySelector('.o_control_panel_actions button[name="a"]'));
    expect(".modal").toHaveCount(1);
    const modalText = target.querySelector(".modal-body").textContent;
    expect(modalText).toBe("Are you sure?");
    await click(document, "body .modal footer button.btn-primary");
    expect(["a"]).toVerifySteps();
});

test("restore orderBy from state when using default order", async () => {
    serverData.models.foo.fields.amount.sortable = true;
    serverData.models.foo.fields.foo.sortable = true;
    serverData.actions = {
        1: {
            id: 1,
            name: "Foo",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [
                [false, "list"],
                [false, "form"],
            ],
        },
    };
    serverData.views = {
        "foo,false,list": `
            <tree default_order="foo">
                <field name="foo"/>
                <field name="amount"/>
            </tree>`,
        "foo,false,form": `
            <form>
                <field name="amount"/>
                <field name="foo"/>
            </form>`,
        "foo,false,search": "<search/>",
    };
    const webclient = await createWebClient({
        async mockRPC(route, { kwargs, method }) {
            if (method === "web_search_read") {
                assert.step("order:" + kwargs.order);
            }
        },
    });
    await doAction(webclient, 1);

    await click(target.querySelector("th[data-name=amount]")); // order by amount
    await click(target.querySelector(".o_data_row .o_data_cell")); // switch to the form view
    await click(target.querySelector(".breadcrumb-item")); // go back to the list view

    assert.verifySteps([
        "order:foo ASC", // initial list view
        "order:amount ASC, foo ASC", // order by amount
        "order:amount ASC, foo ASC", // go back to the list view, it should still be ordered by amount
    ]);
});

test("x2many onchange, check result", async () => {
    const def = makeDeferred();
    serverData.models.foo.onchanges = {
        m2m: function () {},
    };

    await mountView({
        type: "list",
        resModel: "foo",
        arch: `<tree editable="bottom">
                <field name="m2m" widget="many2many_tags"/>
                <field name="m2o"/>
            </tree>`,
        async mockRPC(route, args) {
            if (args.method === "onchange") {
                assert.step("onchange");
                await def;
                return { value: { m2o: [3, "Value 3"] } };
            }
        },
    });

    expect(target.querySelector(".o_data_cell.o_many2many_tags_cell").textContent).toBe("Value 1Value 2");
    expect(target.querySelector(".o_data_cell.o_list_many2one").textContent).toBe("Value 1");
    await click(target.querySelector(".o_data_cell.o_many2many_tags_cell"));
    await selectDropdownItem(target, "m2m", "Value 3");

    expect(["onchange"]).toVerifySteps();
    await click(target.querySelector(".o_list_button_save:not(.btn-link)"));
    def.resolve();
    await nextTick();

    expect(target.querySelector(".o_data_cell.o_many2many_tags_cell").textContent).toBe("Value 1Value 2Value 3");
    expect(target.querySelector(".o_data_cell.o_list_many2one").textContent).toBe("Value 3", { message: "onchange result should be applied" });
});

test("list view: prevent record selection when editable list in edit mode", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo" />
            </tree>`,
    });

    //  When we try to select new record in edit mode
    await click(target.querySelector(".o_control_panel_main_buttons .d-none.d-xl-inline-flex .o_list_button_add"));
    await click(target.querySelector(".o_data_row .o_list_record_selector"));
    expect(target.querySelector('.o_data_row .o_list_record_selector input[type="checkbox"]').checked).toBe(false);

    //  When we try to select all records in edit mode
    await click(target.querySelector("th.o_list_record_selector.o_list_controller"));
    expect(target.querySelector('.o_list_controller input[type="checkbox"]').checked).toBe(false);
});

test("context keys not passed down the stack and not to fields", async () => {
    patchWithCleanup(AutoComplete, {
        timeout: 0,
    });
    serverData.actions = {
        1: {
            id: 1,
            name: "Foo",
            res_model: "foo",
            type: "ir.actions.act_window",
            views: [[false, "list"]],
            context: {
                tree_view_ref: "foo_view_ref",
                search_default_bar: true,
            },
        },
    };
    serverData.views = {
        "foo,foo_view_ref,list": `
            <tree default_order="foo" editable="top">
                <field name="m2m" widget="many2many_tags"/>
            </tree>`,
        "foo,false,search": "<search/>",
        "bar,false,list": `<tree><field name="name" /></tree>`,
        "bar,false,search": "<search/>",
    };

    const barRecs = [];
    for (let i = 1; i < 50; i++) {
        barRecs.push({
            id: i,
            display_name: `Value ${i}`,
        });
    }
    serverData.models.bar.records = barRecs;

    const mockRPC = (route, args) => {
        if (args.method) {
            assert.step(`${args.model}: ${args.method}: ${JSON.stringify(args.kwargs.context)}`);
        }
    };
    const wc = await createWebClient({ serverData, mockRPC });
    await doAction(wc, 1);
    assert.verifySteps([`foo: get_views: {"lang":"en","tz":"taht","uid":7,"tree_view_ref":"foo_view_ref"}`, `foo: web_search_read: {"lang":"en","tz":"taht","uid":7,"bin_size":true,"tree_view_ref":"foo_view_ref"}`]);

    await click(target.querySelectorAll(".o_data_row .o_data_cell")[1]);

    const input = target.querySelector(".o_selected_row .o_field_many2many_tags input");
    await triggerEvent(input, null, "focus");
    await click(input);
    await nextTick();
    assert.verifySteps([`bar: name_search: {"lang":"en","tz":"taht","uid":7}`]);

    const items = Array.from(target.querySelectorAll(".o_selected_row .o_field_many2many_tags .dropdown-item"));
    await click(items.find((el) => el.textContent.trim() === "Search More..."));
    assert.verifySteps([`bar: get_views: {"lang":"en","tz":"taht","uid":7}`, `bar: web_search_read: {"lang":"en","tz":"taht","uid":7,"bin_size":true}`]);
    expect(".modal").toHaveCount(1);
    expect(target.querySelector(".modal .modal-header .modal-title").textContent).toBe("Search: M2M field");
});

test("search nested many2one field with early option selection", async () => {
    const deferred = makeDeferred();
    serverData.models.parent = {
        fields: {
            foo: { string: "Foo", type: "one2many", relation: "foo" },
        },
    };
    await mountView({
        type: "form",
        resModel: "parent",
        arch: `
        <form>
            <field name="foo">
                <tree editable="bottom">
                    <field name="m2o"/>
                </tree>
            </field>
        </form>`,
        mockRPC: async (route, { method }) => {
            if (method === "name_search") {
                await deferred;
            }
        },
    });

    await triggerEvent(document.querySelector(".o_field_x2many_list_row_add a"), null, "click");

    const input = document.activeElement;
    input.value = "alu";
    triggerEvent(document.activeElement, null, "input");
    await nextTick();

    input.value = "alue";
    triggerEvent(document.activeElement, null, "input");
    triggerHotkey("Enter");
    await nextTick();

    deferred.resolve();
    await nextTick();

    expect(input).toBe(document.activeElement);
    expect(input.value).toBe("Value 1");
});

test("monetary field display for rtl languages", async () => {
    patchWithCleanup(localization, {
        direction: "rtl",
    });

    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree><field name="foo"/><field name="amount_currency"/></tree>',
    });

    expect("thead th:nth(2) .o_list_number_th").toHaveCount(1, { message: "header cells of monetary fields should have o_list_number_th class" });
    expect($(target).find("thead th:nth(2)").css("text-align")).toBe("right", { message: "header cells of monetary fields should be right alined" });

    expect($(target).find("tbody tr:first td:nth(2)").css("text-align")).toBe("right", { message: "Monetary cells should be right alined" });

    expect($(target).find("tbody tr:first td:nth(2)").css("direction")).toBe("ltr", { message: "Monetary cells should have ltr direction" });
});

test("add record in editable list view with sample data", async () => {
    serverData.models.foo.records = [];
    let def;
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree sample="1" editable="top"><field name="int_field"/></tree>',
        noContentHelp: "click to add a record",
        mockRPC(route, args) {
            if (args.method === "web_search_read") {
                return def;
            }
        },
    });

    expect(".o_view_sample_data").toHaveCount(1);
    expect(".o_view_nocontent").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);

    def = makeDeferred();
    await clickAdd();

    expect(".o_view_sample_data").toHaveCount(1);
    expect(".o_view_nocontent").toHaveCount(1);
    expect(".o_data_row").toHaveCount(10);

    def.resolve();
    await nextTick();

    expect(".o_view_sample_data").toHaveCount(0);
    expect(".o_view_nocontent").toHaveCount(0);
    expect(".o_data_row").toHaveCount(1);
    expect(".o_data_row.o_selected_row").toHaveCount(1);
});

test("Adding new record in list view with open form view button", async () => {
    await mountView({
        type: "list",
        resModel: "foo",
        arch: '<tree editable="top" open_form_view="1"><field name="foo"/></tree>',
        selectRecord: (resId, options) => {
            assert.step(`switch to form - resId: ${resId} activeIds: ${options.activeIds}`);
        },
    });

    await clickAdd();
    expect("td.o_list_record_open_form_view").toHaveCount(5, { message: "button to open form view should be present on each row" });

    await contains(".o_field_widget[name=foo] input").edit("new");
    await click(target.querySelector("td.o_list_record_open_form_view"));
    expect(["switch to form - resId: 5 activeIds: 5,1,2,3,4"]).toVerifySteps();
});

test("onchange should only be called once after pressing enter on a field", async () => {
    serverData.models.foo.onchanges = {
        foo(record) {
            if (record.foo) {
                record.int_field = 1;
            }
        },
    };
    await mountView({
        type: "list",
        resModel: "foo",
        arch: `
            <tree editable="top">
                <field name="foo"/>
                <field name="int_field"/>
            </tree>`,
        async mockRPC(_, { method }) {
            if (method === "onchange") {
                assert.step(method);
            }
        },
    });
    await click(target.querySelector(".o_data_cell"));
    target.querySelector(".o_field_widget[name=foo] input").value = "1";
    await triggerEvents(target, ".o_field_widget[name=foo] input", [["keydown", { key: "Enter" }], ["change"]]);
    await nextTick();
    assert.verifySteps(["onchange"], "There should only be one onchange call");
});

test("list: remove a record from sorted recordlist", async () => {
    assert.expect(7);

    serverData.models.foo.records = [{ id: 1, o2m: [1, 2, 3, 4, 5, 6] }];
    serverData.models.bar.fields = {
        ...serverData.models.bar.fields,
        name: { string: "Name", type: "char", sortable: true },
        city: { string: "City", type: "boolean", default: false },
    };

    serverData.models.bar.records = [
        { id: 1, name: "a", city: true },
        { id: 2, name: "b" },
        { id: 3, name: "c" },
        { id: 4, name: "d" },
        { id: 5, name: "e" },
        { id: 6, name: "f", city: true },
    ];
    await mountView({
        type: "form",
        resModel: "foo",
        resId: 1,
        mode: "edit",
        arch: `
            <form>
                <sheet>
                    <field name="o2m">
                        <tree limit="2">
                            <field name="id"/>
                            <field name="name" required="not city"/>
                            <field name="city"/>
                        </tree>
                    </field>
                </sheet>
            </form>`,
    });

    // 4 th (1 for delete button, 3 for columns)
    expect("th").toHaveCount(4, { message: "should have 3 columns and delete buttons" });

    expect("tbody tr.o_data_row").toHaveCount(2, { message: "should have 2 rows" });
    expect("th.o_column_sortable").toHaveCount(1, { message: "should have 1 sortable column" });
    const getColNames = () => getNodesTextContent(document.querySelectorAll('.o_data_cell[name="name"'));
    expect(getColNames()).toEqual(["a", "b"], { message: "Should be sorted by id asc" });
    // sort by name desc
    await contains("th.o_column_sortable[data-name=name]").click();
    await contains("th.o_column_sortable[data-name=name]").click();
    expect(getColNames()).toEqual(["f", "e"], { message: "Should be sorted by name desc" });
    // remove second record
    await click(target.querySelectorAll(".o_list_record_remove")[1]);
    expect(getColNames()).toEqual(["f", "d"], { message: "Should be sorted by name desc" });
    // check if the record is removed
    expect(target.querySelector(".o_list_view .o_pager_counter").textContent).toBe("1-2 / 5", { message: "pager should be updated to 1-2 / 5" });
});
