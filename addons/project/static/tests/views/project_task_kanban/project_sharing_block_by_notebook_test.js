/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";
import { start } from "@mail/../tests/helpers/test_utils";

import { getFixture } from "@web/../tests/helpers/utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";

let target;

QUnit.module("Project", (hooks) => {
    hooks.beforeEach(async () => {
        const pyEnv = await startServer();
        const userId = pyEnv['res.users'].create([
            { name: "User Admin", login: 'admin', password: 'admin' },
        ]);
        pyEnv['project.task'].create([
            { name: 'task one', user_ids: [userId] },
            { name: 'task two', user_ids: [userId] },
        ]);
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.debug("project sharing blocked by notebook", async function (assert) {
        const views = {
            "project.task,false,kanban": `
            <kanban>
                <templates>
                    <t t-name="kanban-box">
                        <div class="oe_kanban_global_click">
                            <field name="name"/>
                        </div>
                    </t>
                </templates>
            </kanban>`,
            "project.task,false,form":
            `<form>
                <group>
                    <field name="display_name"/>
                </group>
            </form>`,
        };
        const { openView } = await start({
            serverData: { views },
        });
        await openView({
            res_model: "project.task",
            views: [[false, "kanban"]],
        });

    });
});
