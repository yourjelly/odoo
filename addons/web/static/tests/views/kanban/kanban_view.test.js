import { Component, xml } from "@odoo/owl";
import { expect, test } from "@odoo/hoot";
import { click, queryFirst, queryOne } from "@odoo/hoot-dom";
import {
    defineModels,
    fields,
    models,
    mountView as _mountView,
    onRpc,
} from "@web/../tests/web_test_helpers";

import { registry } from "@web/core/registry";
import { parseXML } from "@web/core/utils/xml";
import { animationFrame } from "@odoo/hoot-mock";

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
    image = fields.Binary({ string: "Image" });

    _records = [
        {
            id: 1,
            foo: "yop",
            bar: true,
            int_field: 10,
            float_field: 0.4,
            product_id: 3,
            category_ids: [],
            image: "R0lGODlhAQABAAD/ACwAAAAAAQABAAACAA==",
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

const PAD = 4;
function formatHTML(string) {
    function _extractLayers(node, layers = [], lvl = 0) {
        if (node.nodeType === 3) {
            const hasContent = !!node.nodeValue.replaceAll(/\s/g, "");
            if (hasContent) {
                layers.push([lvl, [node.nodeValue.replaceAll(/\n/g, "").trim()]]);
            }
            return;
        }
        layers.push([lvl, node.outerHTML.replace(`>${node.innerHTML}<`, ">\n<").split("\n")]);
        const childLevel = lvl + 1;
        for (const child of node.childNodes) {
            _extractLayers(child, layers, childLevel);
        }
        return layers;
    }
    const root = parseXML(string);
    // generate layers
    const layers = _extractLayers(root);
    // generate resulting string
    let i = 0;
    let dir = "up";
    let result = "";
    while (layers.length > 0) {
        const [lvl, [start, end]] = layers[i];
        const pad = new Array(PAD * lvl + 1).join(" ");
        let nextLayerIndex = i + 1;
        if (dir === "up") {
            result += `${pad}${start}\n`;
            if (!end) {
                layers.splice(i, 1);
                nextLayerIndex--;
            }
        } else if (end) {
            result += `${pad}${end}\n`;
            layers.splice(i, 1);
            nextLayerIndex--;
        }
        if (nextLayerIndex >= layers.length) {
            i = nextLayerIndex - 1;
            dir = "down";
            continue;
        }
        const nextLayer = layers[nextLayerIndex];
        const nextLayerLvl = nextLayer[0];
        if (nextLayerLvl > layers[nextLayerIndex - 1][0]) {
            i = nextLayerIndex;
            dir = "up";
        } else {
            i = nextLayerIndex - 1;
            dir = "down";
        }
    }
    return result;
}

function assertHTMLEquality(received, expected) {
    const sanitizedReceived = formatHTML(received);
    const sanitizedExpected = formatHTML(expected);
    expect(sanitizedReceived).toBe(sanitizedExpected);
}

test("kanban arch with sections", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section>
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
                <section>
                    <field name="category_ids" widget="many2many_tags"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
    });

    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100">
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <span>9</span>
                    <span>13.00</span>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <div name="category_ids" class="o_field_widget o_field_many2many_tags">
                        <div class="d-flex flex-wrap gap-1">
                            <span class="o_tag position-relative d-inline-flex align-items-center user-select-none mw-100 o_badge badge rounded-pill lh-1 o_tag_color_0" tabindex="-1" title="gold">
                                <div class="o_tag_badge_text text-truncate">
                                    gold
                                </div>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
    );
});

test("kanban arch with aside", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <aside>
                    <field name="image" widget="kanban_image"/>
                </aside>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section>
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
                <section>
                    <field name="category_ids" widget="many2many_tags"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
    });

    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100 d-flex flew-row">
            <div class="o_kanban_aside">
                <div name="image" class="o_field_widget o_field_empty o_field_kanban_image"/>
            </div>
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <span>9</span>
                    <span>13.00</span>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <div name="category_ids" class="o_field_widget o_field_many2many_tags">
                        <div class="d-flex flex-wrap gap-1">
                            <span class="o_tag position-relative d-inline-flex align-items-center user-select-none mw-100 o_badge badge rounded-pill lh-1 o_tag_color_0" tabindex="-1" title="gold">
                                <div class="o_tag_badge_text text-truncate">
                                    gold
                                </div>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
    );
});

test("kanban arch with aside (full)", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <aside full="1">
                    <field name="image" widget="kanban_image"/>
                </aside>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section>
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
    });

    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100 d-flex flew-row">
            <div class="o_kanban_aside o_kanban_aside_full">
                <div name="image" class="o_field_widget o_field_empty o_field_kanban_image"/>
            </div>
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <span>9</span>
                    <span>13.00</span>
                </div>
            </div>
        </div>`
    );
});

test("kanban arch with section of type row", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section type="row">
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
    });

    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100">
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-row align-items-end">
                    <span>9</span>
                    <span>13.00</span>
                </div>
            </div>
        </div>`
    );
});

test("kanban arch with menu", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <menu>
                    <a type="edit" class="dropdown-item">Edit</a>
                    <a type="delete" class="dropdown-item">Delete</a>
                </menu>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section>
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
    });

    expect(".o_kanban_record:not(.o_kanban_ghost)").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100">
            <div class="o_dropdown_kanban bg-transparent position-absolute end-0 top-0">
                <button class="btn o-no-caret rounded-0 o-dropdown dropdown-toggle dropdown" title="Dropdown menu" aria-expanded="false">
                    <span class="fa fa-ellipsis-v"/>
                </button>
            </div>
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <span>9</span>
                    <span>13.00</span>
                </div>
            </div>
        </div>`
    );

    click(queryOne(".o_kanban_record .o_dropdown_kanban .dropdown-toggle"));
    await animationFrame();
    expect(".o-dropdown--kanban-record-menu").toHaveCount(1);
    expect(".o-dropdown--kanban-record-menu a.dropdown-item").toHaveCount(2);
});

test("kanban arch with progressbar", async () => {
    await mountView({
        type: "kanban",
        resModel: "partner",
        arch: `
            <kanban>
                <progressbar field="foo" colors='{"yop": "success", "gnap": "warning", "blip": "danger"}'/>
                <section>
                    <strong><field name="foo"/></strong>
                </section>
                <section>
                    <field name="int_field"/>
                    <field name="float_field"/>
                </section>
            </kanban>`,
        domain: [["id", "=", 2]],
        groupBy: ["product_id"],
    });

    expect(".o_kanban_group").toHaveCount(1);
    expect(".o_kanban_record").toHaveCount(1);
    expect(".o_kanban_group .o_kanban_counter .o_column_progress").toHaveCount(1);

    assertHTMLEquality(
        queryFirst(".o_kanban_record").innerHTML,
        `<div class="w-100">
            <div class="o_kanban_section_container d-flex flex-column justify-content-between gap-2 w-100 h-100">
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <strong>
                        <span>blip</span>
                    </strong>
                </div>
                <div class="d-flex justify-content-between overflow-hidden flex-column">
                    <span>9</span>
                    <span>13.00</span>
                </div>
            </div>
        </div>`
    );
});

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
