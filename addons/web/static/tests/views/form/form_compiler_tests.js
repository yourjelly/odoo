/** @odoo-module **/
import { makeView } from "../helpers";
import { setupControlPanelServiceRegistry } from "../../search/helpers";

QUnit.module("Form Compiler", (hooks) => {
    let serverData;

    hooks.beforeEach(() => {
        setupControlPanelServiceRegistry();
        serverData = {
            models: {
                partner: {
                    fields: {
                        display_name: { type: "char" },
                        charfield: { type: "char" },
                    },
                    records: [
                        { id: 1, display_name: "firstRecord", charfield: "content of charfield" },
                    ],
                },
            },
        };
    });

    QUnit.test("compile simple div", async (assert) => {
        assert.expect(0);

        serverData.views = {
            "partner,1,form": `<form><div>lol</div></form>`,
        };

        const form = await makeView({
            serverData,
            resModel: "partner",
            type: "form",
            resId: 1,
        });
    });

    QUnit.test("compile inner groups", async (assert) => {
        assert.expect(0);

        serverData.views = {
            "partner,1,form": /*xml*/ `
                <form>
                    <group>
                        <group><field name="display_name"/></group>
                        <group><field name="charfield"/></group>
                    </group>
                </form>`,
        };

        const form = await makeView({
            serverData,
            resModel: "partner",
            type: "form",
            resId: 1,
        });
    });

    QUnit.test("compile notebook", async (assert) => {
        assert.expect(0);

        serverData.views = {
            "partner,1,form": /*xml*/ `
                <form>
                    <sheet>
                        <notebook>
                            <page name="p1"><field name="charfield"/></page>
                            <page name="p2"><field name="display_name"/></page>
                        </notebook>
                    </sheet>
                </form>`,
        };

        const form = await makeView({
            serverData,
            resModel: "partner",
            type: "form",
            resId: 1,
        });
    });

    QUnit.debug("compile notebook", async (assert) => {
        assert.expect(0);

        serverData.views = {
            "partner,1,form": /*xml*/ `
                <form>
                    <sheet>
                        <notebook>
                            <page name="p1" attrs="{'invisible': [['display_name', '=', 'lol']]}"><field name="charfield"/></page>
                            <page name="p2"><field name="display_name"/></page>
                        </notebook>
                    </sheet>
                </form>`,
        };

        const form = await makeView({
            serverData,
            resModel: "partner",
            type: "form",
            resId: 1,
        });
    });
});
