import { beforeEach, expect, test } from "@odoo/hoot";
import { queryText } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import { mountView, onRpc, contains, getKanbanColumn, toggleKanbanColumnActions } from "@web/../tests/web_test_helpers";

import { defineProjectModels, ProjectTask } from "./project_models";

defineProjectModels();
beforeEach(() => {
    ProjectTask._records = [
        {
            id: 1,
            name: "My task",
            project_id: false,
            user_ids: [],
            date_deadline: false,
            stage_id: 1,
        },
    ];
});

test("project.task (tree): check group label for no project", async () => {
    await mountView({
        resModel: "project.task",
        type: "list",
        arch: `<tree js_class="project_task_list"/>`,
        groupBy: ["project_id"],
    });
    expect(".o_group_name").toHaveText("🔒 Private (1)");
});

test("project.task (tree): check group label for no assignees", async () => {
    await mountView({
        resModel: "project.task",
        type: "list",
        arch: `<tree js_class="project_task_list"/>`,
        groupBy: ["user_ids"],
    });
    expect(".o_group_name").toHaveText("👤 Unassigned (1)");
});

test("project.task (tree): check group label for no deadline", async () => {
    await mountView({
        resModel: "project.task",
        type: "list",
        arch: `<tree js_class="project_task_list"/>`,
        groupBy: ["date_deadline"],
    });
    expect(".o_group_name").toHaveText("None (1)");
});

test("project.task (kanban): check group label for no project", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <kanban js_class="project_task_kanban" default_group_by="project_id">
                <templates>
                    <t t-name="kanban-box"/>
                </templates>
            </kanban>
        `,
    });
    expect(".o_column_title").toHaveText("🔒 Private\n1");
});

test("project.task (kanban): check group label for no assignees", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <kanban js_class="project_task_kanban" default_group_by="user_ids">
                <templates>
                    <t t-name="kanban-box"/>
                </templates>
            </kanban>
        `,
    });
    expect(".o_column_title").toHaveText("👤 Unassigned\n1");
});

test("project.task (kanban): check group label for no deadline", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <kanban js_class="project_task_kanban" default_group_by="date_deadline">
                <templates>
                    <t t-name="kanban-box"/>
                </templates>
            </kanban>
        `,
    });
    expect(".o_column_title").toHaveText("None");
});

test("project.task (pivot): check group label for no project", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <pivot js_class="project_pivot">
                <field name="project_id" type="row"/>
            </pivot>
        `,
    });
    expect("tr:nth-of-type(2) .o_pivot_header_cell_closed").toHaveText("Private");
});

test("project.task (pivot): check group label for no assignees", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <pivot js_class="project_pivot">
                <field name="user_ids" type="row"/>
            </pivot>
        `,
    });
    expect("tr:nth-of-type(2) .o_pivot_header_cell_closed").toHaveText("Unassigned");
});

test("project.task (pivot): check group label for no deadline", async () => {
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <pivot js_class="project_pivot">
                <field name="date_deadline" type="row"/>
            </pivot>
        `,
    });
    expect("tr:nth-of-type(2) .o_pivot_header_cell_closed").toHaveText("None");
});

test("project.task (kanban): delete a column in grouped on m2o", async () => {
    onRpc(({ method, model }) => {
        if (model === "project.task.type" && method === "unlink_wizard") {
            expect.step(method);
            return {
                type: "ir.actions.client",
                tag: "reload",
            };
        }
    });
    await mountView({
        resModel: "project.task",
        type: "kanban",
        arch: `
            <kanban default_group_by="stage_id" js_class="project_task_kanban">
                <templates>
                    <t t-name="kanban-box">
                        <div>
                            <field name="name"/>
                        </div>
                    </t>
                </templates>
            </kanban>
        `,
        groupBy: ["stage_id"],
        context: {
            default_project_id: 1,
        },
    });
    expect(".o_kanban_group").toHaveCount(1, { message: "should have two columns" });
    expect(queryText(".o_column_title", { root: getKanbanColumn(0) })).toBe("Todo");
    const clickColumnAction = await toggleKanbanColumnActions(0);
    await clickColumnAction("Delete");
    // expect.verifySteps(["unlink_wizard"]);
    await animationFrame();
    expect(".o_dialog").toHaveCount(1);
    await contains(".o_dialog footer .btn-primary").click();
    // await nextTick();
    expect(".o_column_quick_create").toHaveCount(1);
});
