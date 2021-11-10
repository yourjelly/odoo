/** @odoo-module **/

import { dialogService } from "@web/core/dialog/dialog_service";
import { registry } from "@web/core/registry";
import { makeFakeLocalizationService, makeFakeUserService } from "../helpers/mock_services";
import { click, makeDeferred, nextTick, triggerEvent, triggerEvents } from "../helpers/utils";
import {
    setupControlPanelFavoriteMenuRegistry,
    setupControlPanelServiceRegistry,
} from "../search/helpers";
import { makeView } from "../views/helpers";

const serviceRegistry = registry.category("services");

let serverData;

function hasGroup(group) {
    return group === "base.group_allow_export";
}

QUnit.module("Fields", (hooks) => {
    hooks.beforeEach(() => {
        serverData = {
            models: {
                partner: {
                    fields: {
                        date: { string: "A date", type: "date", searchable: true },
                        datetime: { string: "A datetime", type: "datetime", searchable: true },
                        display_name: { string: "Displayed name", type: "char", searchable: true },
                        foo: {
                            string: "Foo",
                            type: "char",
                            default: "My little Foo Value",
                            searchable: true,
                            trim: true,
                        },
                        bar: { string: "Bar", type: "boolean", default: true, searchable: true },
                        empty_string: {
                            string: "Empty string",
                            type: "char",
                            default: false,
                            searchable: true,
                            trim: true,
                        },
                        txt: {
                            string: "txt",
                            type: "text",
                            default: "My little txt Value\nHo-ho-hoooo Merry Christmas",
                        },
                        int_field: {
                            string: "int_field",
                            type: "integer",
                            sortable: true,
                            searchable: true,
                        },
                        qux: { string: "Qux", type: "float", digits: [16, 1], searchable: true },
                        p: {
                            string: "one2many field",
                            type: "one2many",
                            relation: "partner",
                            searchable: true,
                        },
                        trululu: {
                            string: "Trululu",
                            type: "many2one",
                            relation: "partner",
                            searchable: true,
                        },
                        timmy: {
                            string: "pokemon",
                            type: "many2many",
                            relation: "partner_type",
                            searchable: true,
                        },
                        product_id: {
                            string: "Product",
                            type: "many2one",
                            relation: "product",
                            searchable: true,
                        },
                        sequence: { type: "integer", string: "Sequence", searchable: true },
                        currency_id: {
                            string: "Currency",
                            type: "many2one",
                            relation: "currency",
                            searchable: true,
                        },
                        selection: {
                            string: "Selection",
                            type: "selection",
                            searchable: true,
                            selection: [
                                ["normal", "Normal"],
                                ["blocked", "Blocked"],
                                ["done", "Done"],
                            ],
                        },
                        document: { string: "Binary", type: "binary" },
                        hex_color: { string: "hexadecimal color", type: "char" },
                    },
                    records: [
                        {
                            id: 1,
                            date: "2017-02-03",
                            datetime: "2017-02-08 10:00:00",
                            display_name: "first record",
                            bar: true,
                            foo: "yop",
                            int_field: 10,
                            qux: 0.44444,
                            p: [],
                            timmy: [],
                            trululu: 4,
                            selection: "blocked",
                            document: "coucou==\n",
                            hex_color: "#ff0000",
                        },
                        {
                            id: 2,
                            display_name: "second record",
                            bar: true,
                            foo: "blip",
                            int_field: 0,
                            qux: 0,
                            p: [],
                            timmy: [],
                            trululu: 1,
                            sequence: 4,
                            currency_id: 2,
                            selection: "normal",
                        },
                        {
                            id: 4,
                            display_name: "aaa",
                            foo: "abc",
                            sequence: 9,
                            int_field: false,
                            qux: false,
                            selection: "done",
                        },
                        { id: 3, bar: true, foo: "gnap", int_field: 80, qux: -3.89859 },
                        { id: 5, bar: false, foo: "blop", int_field: -4, qux: 9.1, currency_id: 1 },
                    ],
                    onchanges: {},
                },
                product: {
                    fields: {
                        name: { string: "Product Name", type: "char", searchable: true },
                    },
                    records: [
                        {
                            id: 37,
                            display_name: "xphone",
                        },
                        {
                            id: 41,
                            display_name: "xpad",
                        },
                    ],
                },
                partner_type: {
                    fields: {
                        name: { string: "Partner Type", type: "char", searchable: true },
                        color: { string: "Color index", type: "integer", searchable: true },
                    },
                    records: [
                        { id: 12, display_name: "gold", color: 2 },
                        { id: 14, display_name: "silver", color: 5 },
                    ],
                },
                currency: {
                    fields: {
                        digits: { string: "Digits" },
                        symbol: { string: "Currency Sumbol", type: "char", searchable: true },
                        position: { string: "Currency Position", type: "char", searchable: true },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "$",
                            symbol: "$",
                            position: "before",
                        },
                        {
                            id: 2,
                            display_name: "€",
                            symbol: "€",
                            position: "after",
                        },
                    ],
                },
                "ir.translation": {
                    fields: {
                        lang: { type: "char" },
                        value: { type: "char" },
                        res_id: { type: "integer" },
                    },
                    records: [
                        {
                            id: 99,
                            res_id: 37,
                            value: "",
                            lang: "en_US",
                        },
                    ],
                },
            },
        };

        setupControlPanelFavoriteMenuRegistry();
        setupControlPanelServiceRegistry();
        serviceRegistry.add("dialog", dialogService);
        serviceRegistry.add("user", makeFakeUserService(hasGroup), { force: true });
    });

    QUnit.module("LabelSelectionField");

    QUnit.skip("LabelSelectionField in form view", async function (assert) {
        assert.expect(12);

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch:
                '<form string="Partners">' +
                "<sheet>" +
                "<group>" +
                '<field name="selection" widget="label_selection" ' +
                " options=\"{'classes': {'normal': 'secondary', 'blocked': 'warning','done': 'success'}}\"/>" +
                "</group>" +
                "</sheet>" +
                "</form>",
            res_id: 1,
        });

        assert.containsOnce(
            form,
            ".o_field_widget.badge.badge-warning",
            "should have a warning status label since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-secondary",
            "should not have a default status since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-success",
            "should not have a success status since selection is the second, blocked state"
        );
        assert.strictEqual(
            form.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the label should say 'Blocked' since this is the label value for that state"
        );

        // // switch to edit mode and check the result
        await testUtils.form.clickEdit(form);
        assert.containsOnce(
            form,
            ".o_field_widget.badge.badge-warning",
            "should have a warning status label since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-secondary",
            "should not have a default status since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-success",
            "should not have a success status since selection is the second, blocked state"
        );
        assert.strictEqual(
            form.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the label should say 'Blocked' since this is the label value for that state"
        );

        // save
        await testUtils.form.clickSave(form);
        assert.containsOnce(
            form,
            ".o_field_widget.badge.badge-warning",
            "should have a warning status label since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-secondary",
            "should not have a default status since selection is the second, blocked state"
        );
        assert.containsNone(
            form,
            ".o_field_widget.badge.badge-success",
            "should not have a success status since selection is the second, blocked state"
        );
        assert.strictEqual(
            form.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the label should say 'Blocked' since this is the label value for that state"
        );

        form.destroy();
    });

    QUnit.skip("LabelSelectionField in editable list view", async function (assert) {
        assert.expect(21);

        var list = await createView({
            View: ListView,
            model: "partner",
            data: this.data,
            arch:
                '<tree editable="bottom">' +
                '<field name="foo"/>' +
                '<field name="selection" widget="label_selection"' +
                " options=\"{'classes': {'normal': 'secondary', 'blocked': 'warning','done': 'success'}}\"/>" +
                "</tree>",
        });

        assert.strictEqual(
            list.$(".o_field_widget.badge:not(:empty)").length,
            3,
            "should have three visible status labels"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-warning",
            "should have one warning status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the warning label should read 'Blocked'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-secondary",
            "should have one default status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-secondary").text(),
            "Normal",
            "the default label should read 'Normal'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-success",
            "should have one success status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-success").text(),
            "Done",
            "the success label should read 'Done'"
        );

        // switch to edit mode and check the result
        await testUtils.dom.clickFirst(list.$("tbody td:not(.o_list_record_selector)"));
        assert.strictEqual(
            list.$(".o_field_widget.badge:not(:empty)").length,
            3,
            "should have three visible status labels"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-warning",
            "should have one warning status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the warning label should read 'Blocked'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-secondary",
            "should have one default status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-secondary").text(),
            "Normal",
            "the default label should read 'Normal'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-success",
            "should have one success status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-success").text(),
            "Done",
            "the success label should read 'Done'"
        );

        // save and check the result
        await testUtils.dom.click(list.$buttons.find(".o_list_button_save"));
        assert.strictEqual(
            list.$(".o_field_widget.badge:not(:empty)").length,
            3,
            "should have three visible status labels"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-warning",
            "should have one warning status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-warning").text(),
            "Blocked",
            "the warning label should read 'Blocked'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-secondary",
            "should have one default status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-secondary").text(),
            "Normal",
            "the default label should read 'Normal'"
        );
        assert.containsOnce(
            list,
            ".o_field_widget.badge.badge-success",
            "should have one success status label"
        );
        assert.strictEqual(
            list.$(".o_field_widget.badge.badge-success").text(),
            "Done",
            "the success label should read 'Done'"
        );

        list.destroy();
    });
});
