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
                        display_name: { string: "Displayed name", type: "char" },
                        foo: { string: "Foo", type: "char", default: "My little Foo Value" },
                        bar: { string: "Bar", type: "boolean", default: true },
                        int_field: { string: "int_field", type: "integer", sortable: true },
                        qux: { string: "Qux", type: "float", digits: [16, 1] },
                        p: {
                            string: "one2many field",
                            type: "one2many",
                            relation: "partner",
                            relation_field: "trululu",
                        },
                        turtles: {
                            string: "one2many turtle field",
                            type: "one2many",
                            relation: "turtle",
                            relation_field: "turtle_trululu",
                        },
                        trululu: { string: "Trululu", type: "many2one", relation: "partner" },
                        timmy: { string: "pokemon", type: "many2many", relation: "partner_type" },
                        product_id: { string: "Product", type: "many2one", relation: "product" },
                        color: {
                            type: "selection",
                            selection: [
                                ["red", "Red"],
                                ["black", "Black"],
                            ],
                            default: "red",
                            string: "Color",
                        },
                        date: { string: "Some Date", type: "date" },
                        datetime: { string: "Datetime Field", type: "datetime" },
                        user_id: { string: "User", type: "many2one", relation: "user" },
                        reference: {
                            string: "Reference Field",
                            type: "reference",
                            selection: [
                                ["product", "Product"],
                                ["partner_type", "Partner Type"],
                                ["partner", "Partner"],
                            ],
                        },
                        model_id: { string: "Model", type: "many2one", relation: "ir.model" },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "first record",
                            bar: true,
                            foo: "yop",
                            int_field: 10,
                            qux: 0.44,
                            p: [],
                            turtles: [2],
                            timmy: [],
                            trululu: 4,
                            user_id: 17,
                            reference: "product,37",
                        },
                        {
                            id: 2,
                            display_name: "second record",
                            bar: true,
                            foo: "blip",
                            int_field: 9,
                            qux: 13,
                            p: [],
                            timmy: [],
                            trululu: 1,
                            product_id: 37,
                            date: "2017-01-25",
                            datetime: "2016-12-12 10:55:05",
                            user_id: 17,
                        },
                        {
                            id: 4,
                            display_name: "aaa",
                            bar: false,
                        },
                    ],
                    onchanges: {},
                },
                product: {
                    fields: {
                        name: { string: "Product Name", type: "char" },
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
                        name: { string: "Partner Type", type: "char" },
                        color: { string: "Color index", type: "integer" },
                    },
                    records: [
                        { id: 12, display_name: "gold", color: 2 },
                        { id: 14, display_name: "silver", color: 5 },
                    ],
                },
                turtle: {
                    fields: {
                        display_name: { string: "Displayed name", type: "char" },
                        turtle_foo: { string: "Foo", type: "char" },
                        turtle_bar: { string: "Bar", type: "boolean", default: true },
                        turtle_int: { string: "int", type: "integer", sortable: true },
                        turtle_description: { string: "Description", type: "text" },
                        turtle_trululu: {
                            string: "Trululu",
                            type: "many2one",
                            relation: "partner",
                        },
                        turtle_ref: {
                            string: "Reference",
                            type: "reference",
                            selection: [
                                ["product", "Product"],
                                ["partner", "Partner"],
                            ],
                        },
                        product_id: {
                            string: "Product",
                            type: "many2one",
                            relation: "product",
                            required: true,
                        },
                        partner_ids: { string: "Partner", type: "many2many", relation: "partner" },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "leonardo",
                            turtle_bar: true,
                            turtle_foo: "yop",
                            partner_ids: [],
                        },
                        {
                            id: 2,
                            display_name: "donatello",
                            turtle_bar: true,
                            turtle_foo: "blip",
                            turtle_int: 9,
                            partner_ids: [2, 4],
                        },
                        {
                            id: 3,
                            display_name: "raphael",
                            product_id: 37,
                            turtle_bar: false,
                            turtle_foo: "kawa",
                            turtle_int: 21,
                            partner_ids: [],
                            turtle_ref: "product,37",
                        },
                    ],
                    onchanges: {},
                },
                user: {
                    fields: {
                        name: { string: "Name", type: "char" },
                        partner_ids: {
                            string: "one2many partners field",
                            type: "one2many",
                            relation: "partner",
                            relation_field: "user_id",
                        },
                    },
                    records: [
                        {
                            id: 17,
                            name: "Aline",
                            partner_ids: [1, 2],
                        },
                        {
                            id: 19,
                            name: "Christine",
                        },
                    ],
                },
                "ir.model": {
                    fields: {
                        model: { string: "Model", type: "char" },
                    },
                    records: [
                        {
                            id: 17,
                            name: "Partner",
                            model: "partner",
                        },
                        {
                            id: 20,
                            name: "Product",
                            model: "product",
                        },
                        {
                            id: 21,
                            name: "Partner Type",
                            model: "partner_type",
                        },
                    ],
                    onchanges: {},
                },
            },
        };

        setupControlPanelFavoriteMenuRegistry();
        setupControlPanelServiceRegistry();
        serviceRegistry.add("dialog", dialogService);
        serviceRegistry.add("user", makeFakeUserService(hasGroup), { force: true });
    });

    QUnit.module("RadioField");

    QUnit.skip("fieldradio widget on a many2one in a new record", async function (assert) {
        assert.expect(6);

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch: "<form>" + '<field name="product_id" widget="radio"/>' + "</form>",
        });

        assert.ok(form.$("div.o_radio_item").length, "should have rendered outer div");
        assert.containsN(form, "input.o_radio_input", 2, "should have 2 possible choices");
        assert.ok(
            form.$("label.o_form_label:contains(xphone)").length,
            "one of them should be xphone"
        );
        assert.containsNone(form, "input:checked", "none of the input should be checked");

        await testUtils.dom.click(form.$("input.o_radio_input:first"));

        assert.containsOnce(form, "input:checked", "one of the input should be checked");

        await testUtils.form.clickSave(form);

        var newRecord = _.last(this.data.partner.records);
        assert.strictEqual(newRecord.product_id, 37, "should have saved record with correct value");
        form.destroy();
    });

    QUnit.skip("fieldradio change value by onchange", async function (assert) {
        assert.expect(4);

        this.data.partner.onchanges = {
            bar: function (obj) {
                obj.product_id = obj.bar ? 41 : 37;
                obj.color = obj.bar ? "red" : "black";
            },
        };

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch:
                "<form>" +
                '<field name="bar"/>' +
                '<field name="product_id" widget="radio"/>' +
                '<field name="color" widget="radio"/>' +
                "</form>",
        });

        await testUtils.dom.click(form.$("input[type='checkbox']"));
        assert.containsOnce(
            form,
            'input.o_radio_input[data-value="37"]:checked',
            "one of the input should be checked"
        );
        assert.containsOnce(
            form,
            'input.o_radio_input[data-value="black"]:checked',
            "the other of the input should be checked"
        );
        await testUtils.dom.click(form.$("input[type='checkbox']"));
        assert.containsOnce(
            form,
            'input.o_radio_input[data-value="41"]:checked',
            "the other of the input should be checked"
        );
        assert.containsOnce(
            form,
            'input.o_radio_input[data-value="red"]:checked',
            "one of the input should be checked"
        );

        form.destroy();
    });

    QUnit.skip("fieldradio widget on a selection in a new record", async function (assert) {
        assert.expect(4);

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch: "<form>" + '<field name="color" widget="radio"/>' + "</form>",
        });

        assert.ok(form.$("div.o_radio_item").length, "should have rendered outer div");
        assert.containsN(form, "input.o_radio_input", 2, "should have 2 possible choices");
        assert.ok(form.$("label.o_form_label:contains(Red)").length, "one of them should be Red");

        // click on 2nd option
        await testUtils.dom.click(form.$("input.o_radio_input").eq(1));

        await testUtils.form.clickSave(form);

        var newRecord = _.last(this.data.partner.records);
        assert.strictEqual(newRecord.color, "black", "should have saved record with correct value");
        form.destroy();
    });

    QUnit.skip("fieldradio widget has o_horizontal or o_vertical class", async function (assert) {
        assert.expect(2);

        this.data.partner.fields.color2 = this.data.partner.fields.color;

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch:
                "<form>" +
                "<group>" +
                '<field name="color" widget="radio"/>' +
                '<field name="color2" widget="radio" options="{\'horizontal\': True}"/>' +
                "</group>" +
                "</form>",
        });

        var btn1 = form.$("div.o_field_radio.o_vertical");
        var btn2 = form.$("div.o_field_radio.o_horizontal");

        assert.strictEqual(btn1.length, 1, "should have o_vertical class");
        assert.strictEqual(btn2.length, 1, "should have o_horizontal class");
        form.destroy();
    });

    QUnit.skip("fieldradio widget with numerical keys encoded as strings", async function (assert) {
        assert.expect(7);

        this.data.partner.fields.selection = {
            type: "selection",
            selection: [
                ["0", "Red"],
                ["1", "Black"],
            ],
        };

        var form = await createView({
            View: FormView,
            model: "partner",
            data: this.data,
            arch: "<form>" + '<field name="selection" widget="radio"/>' + "</form>",
            res_id: 1,
            mockRPC: function (route, args) {
                if (args.method === "write") {
                    assert.strictEqual(args.args[1].selection, "1", "should write correct value");
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.strictEqual(
            form.$(".o_field_widget").text().trim().split(/\s+/g).join(","),
            "Red,Black"
        );
        assert.containsNone(form, ".o_radio_input:checked", "no value should be checked");

        await testUtils.form.clickEdit(form);

        assert.containsNone(form, ".o_radio_input:checked", "no value should be checked");

        await testUtils.dom.click(form.$("input.o_radio_input:nth(1)"));

        await testUtils.form.clickSave(form);

        assert.strictEqual(
            form.$(".o_field_widget").text().trim().split(/\s+/g).join(","),
            "Red,Black"
        );
        assert.containsOnce(
            form,
            ".o_radio_input[data-index=1]:checked",
            "'Black' should be checked"
        );

        await testUtils.form.clickEdit(form);

        assert.containsOnce(
            form,
            ".o_radio_input[data-index=1]:checked",
            "'Black' should be checked"
        );

        form.destroy();
    });

    QUnit.skip(
        "widget radio on a many2one: domain updated by an onchange",
        async function (assert) {
            assert.expect(4);

            this.data.partner.onchanges = {
                int_field: function () {},
            };

            var domain = [];
            var form = await createView({
                View: FormView,
                model: "partner",
                data: this.data,
                arch:
                    "<form>" +
                    '<field name="int_field"/>' +
                    '<field name="trululu" widget="radio"/>' +
                    "</form>",
                res_id: 1,
                mockRPC: function (route, args) {
                    if (args.method === "onchange") {
                        domain = [["id", "in", [10]]];
                        return Promise.resolve({
                            value: {
                                trululu: false,
                            },
                            domain: {
                                trululu: domain,
                            },
                        });
                    }
                    if (args.method === "search_read") {
                        assert.deepEqual(
                            args.kwargs.domain,
                            domain,
                            "sent domain should be correct"
                        );
                    }
                    return this._super(route, args);
                },
                viewOptions: {
                    mode: "edit",
                },
            });

            assert.containsN(
                form,
                ".o_field_widget[name=trululu] .o_radio_item",
                3,
                "should be 3 radio buttons"
            );

            // trigger an onchange that will update the domain
            await testUtils.fields.editInput(form.$(".o_field_widget[name=int_field]"), 2);
            assert.containsNone(
                form,
                ".o_field_widget[name=trululu] .o_radio_item",
                "should be no more radio button"
            );

            form.destroy();
        }
    );
});
