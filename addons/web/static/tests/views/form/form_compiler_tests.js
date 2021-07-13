/** @odoo-module **/
import { makeView } from "../helpers";
import { setupControlPanelServiceRegistry } from "../../search/helpers";
import { FormCompiler } from "@web/views/form/form_renderer";

function compileTemplate(arch) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(arch, "text/xml");
    const compiler = new FormCompiler();
    return compiler.compile(xml.documentElement).outerHTML;
}

QUnit.assert.areEquivalent = function (template1, template2) {
    if (template1.replace(/\s/g, "") === template2.replace(/\s/g, "")) {
        QUnit.assert.ok(true);
    } else {
        QUnit.assert.strictEqual(template1, template2);
    }
};

QUnit.assert.areContentEquivalent = function (template, content) {
    debugger;
    const parser = new DOMParser();
    const doc = parser.parseFromString(template, "text/xml");
    const templateContent = doc.documentElement.firstChild.innerHTML;
    QUnit.assert.areEquivalent(templateContent, content);
};

QUnit.module("Form Compiler", (hooks) => {
    QUnit.test("properly compile simple div", async (assert) => {
        const arch = /*xml*/ `<form><div>lol</div></form>`;
        const expected = /*xml*/ `
            <t>
                <div
                    class=\"o_form_view\"
                    t-attf-class=\"{{props.mode === 'readonly' ? 'o_form_readonly' : 'o_form_editable'}}\"
                >
                    <div>lol</div>
                </div>
            </t>`;

        assert.areEquivalent(compileTemplate(arch), expected);
    });

    QUnit.test("properly compile inner groups", async (assert) => {
        const arch = /*xml*/ `
            <form>
                <group>
                    <group><field name="display_name"/></group>
                    <group><field name="charfield"/></group>
                </group>
            </form>`;
        const expected = /*xml*/ `
            <div class=\"o_group\">
                <table class=\"o_group o_inner_group o_group_col_6\">
                    <tbody>
                        <tr>
                            <Field name=\"&quot;display_name&quot;\" record=\"record\" mode=\"props.mode\"/>
                        </tr>
                    </tbody>
                </table>
                <table class=\"o_group o_inner_group o_group_col_6\">
                    <tbody>
                        <tr>
                            <Field name=\"&quot;charfield&quot;\" record=\"record\" mode=\"props.mode\"/>
                        </tr>
                    </tbody>
                </table>
            </div>`;

        assert.areContentEquivalent(compileTemplate(arch), expected);
    });

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

    QUnit.test("compile notebook", async (assert) => {
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
