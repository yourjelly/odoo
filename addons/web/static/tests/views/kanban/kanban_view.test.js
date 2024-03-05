import { Component, xml } from "@odoo/owl";
import { expect, test } from "@odoo/hoot";
import { queryFirst } from "@odoo/hoot-dom";
import {
    defineModels,
    fields,
    models,
    mountView as _mountView,
    onRpc,
} from "@web/../tests/web_test_helpers";

import { registry } from "@web/core/registry";

// TODO: remove this once we no longer support the old semantic
function mountView({ arch }) {
    if (arch.includes("kanban-box")) {
        throw new Error(
            "Received an old semantic kanban arch. Either convert it, or move the test to kanban_view_old_semantic.test.js"
        );
    }
    return _mountView(...arguments);
}

class Partner extends models.Model {
    _name = "partner";

    foo = fields.Char({ string: "Foo" });
    bar = fields.Boolean({ string: "Bar" });
    int_field = fields.Integer({ string: "int_field", sortable: true, aggregator: "sum" });
    float_field = fields.Float({ string: "float_field", aggregator: "sum" });
    product_id = fields.Many2one({ string: "Products", relation: "product" });
    category_ids = fields.Many2many({ string: "Categories", relation: "category" });

    _records = [
        {
            id: 1,
            foo: "yop",
            bar: true,
            int_field: 10,
            float_field: 0.4,
            product_id: 3,
            category_ids: [],
        },
        {
            id: 2,
            foo: "blip",
            bar: true,
            int_field: 9,
            float_field: 13,
            product_id: 5,
            category_ids: [6],
        },
        {
            id: 3,
            foo: "gnap",
            bar: true,
            int_field: 17,
            float_field: -3,
            product_id: 3,
            category_ids: [7],
        },
        {
            id: 4,
            foo: "blip",
            bar: false,
            int_field: -4,
            float_field: 9,
            product_id: 5,
            category_ids: [],
        },
    ];
}

class Product extends models.Model {
    _name = "product";

    name = fields.Char({ string: "Product Name" });

    _records = [
        { id: 3, name: "hello" },
        { id: 5, name: "xmo" },
    ];
}

class Category extends models.Model {
    _name = "category";

    name = fields.Char({ string: "Category Name" });
    color = fields.Integer({ string: "Color Index" });

    _records = [
        { id: 6, name: "gold", color: 2 },
        { id: 7, name: "silver", color: 5 },
    ];
}

defineModels([Partner, Product, Category]);

test("basic ungrouped rendering", async () => {
    onRpc((_, { method, kwargs }) => {
        if (method === "web_search_read") {
            expect(kwargs.context.bin_size).toBe(true);
        }
    });

    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban class="o_kanban_test">
                <div>
                    <field name="foo"/>
                </div>
            </kanban>`,
    });

    expect(".o_kanban_view").toHaveClass("o_kanban_test");
    expect(".o_kanban_renderer").toHaveClass("o_kanban_ungrouped");
    expect(
        ".o_control_panel_main_buttons .d-none.d-xl-inline-flex button.o-kanban-button-new"
    ).toHaveCount(1);
    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(4);
    expect(".o_kanban_ghost").toHaveCount(6);
    expect(".o_kanban_record:contains(gnap)").toHaveCount(1);
});

test("kanban rendering with class and style attributes", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban class="myCustomClass" style="border: 1px solid red;">
                <div>
                    <field name="foo"/>
                </div>
            </kanban>`,
    });
    expect("[style*='border: 1px solid red;']").toHaveCount(0, {
        message: "style attribute should not be copied",
    });
    expect(".o_view_controller.o_kanban_view.myCustomClass").toHaveCount(1, {
        message: "class attribute should be passed to the view controller",
    });
    expect(".myCustomClass").toHaveCount(1, {
        message: "class attribute should ONLY be passed to the view controller",
    });
});

test("generic tags are case insensitive", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <Div class="test">Hello</Div>
            </kanban>`,
    });

    expect("div.test").toHaveCount(4);
});

test("float fields are formatted properly without using a widget", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <div>
                    <field name="float_field" digits="[0,5]"/>
                </div>
                <div>
                    <field name="float_field" digits="[0,3]"/>
                </div>
            </kanban>`,
    });

    expect(queryFirst(".o_kanban_record")).toHaveText("0.40000\n0.400");
});

test("field with widget and attributes in kanban", async () => {
    expect.assertions(1);

    const myField = {
        component: class MyField extends Component {
            static template = xml`<span/>`;
            static props = ["*"];
            setup() {
                if (this.props.record.resId === 1) {
                    expect(this.props.attrs).toEqual({
                        str: "some string",
                        bool: "true",
                        num: "4.5",
                    });
                }
            }
        },
        extractProps: ({ attrs }) => ({ attrs }),
    };
    registry.category("fields").add("my_field", myField);

    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <div>
                    <field name="int_field" widget="my_field"
                        str="some string"
                        bool="true"
                        num="4.5"
                    />
                </div>
            </kanban>`,
    });
});
