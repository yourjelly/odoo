/** @odoo-module **/

import KanbanView from "web.KanbanView";
import { createView } from "web.test_utils";

let serverData;

QUnit.module("Views", (hooks) => {
    hooks.beforeEach(() => {
        serverData = {
            partner: {
                fields: {
                    foo: { string: "Foo", type: "char" },
                    bar: { string: "Bar", type: "boolean" },
                },
                records: [
                    {
                        id: 1,
                        bar: true,
                        foo: "yop",
                    },
                    {
                        id: 2,
                        bar: true,
                        foo: "blip",
                    },
                    {
                        id: 3,
                        bar: true,
                        foo: "gnap",
                    },
                    {
                        id: 4,
                        bar: false,
                        foo: "blip",
                    },
                ],
            },
        };
    });

    QUnit.module("KanbanView");

    QUnit.test("grouped rendering on mobile", async (assert) => {
        const kanban = await createView({
            View: KanbanView,
            model: "partner",
            data: serverData,
            arch: `
                <kanban class="o_kanban_test">
                    <field name="bar"/>
                    <templates><t t-name="kanban-box">
                        <div><field name="foo"/></div>
                    </t></templates>
                </kanban>
            `,
            groupBy: ["bar"],
        });

        assert.hasClass(kanban.el, "o_action_delegate_scroll");
        assert.hasClass(kanban.el.querySelector(".o_kanban_view"), "o_kanban_grouped");
        assert.containsN(kanban, ".o_kanban_group", 2);
        assert.containsOnce(kanban, ".o_kanban_group:nth-child(1) .o_kanban_record");
        assert.containsN(kanban, ".o_kanban_group:nth-child(2) .o_kanban_record", 3);

        assert.containsNone(
            kanban,
            ".o_kanban_header:first .o_kanban_config .o_kanban_toggle_fold"
        );

        kanban.destroy();
    });
});
