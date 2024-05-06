import { click, contains, editInput} from "@mail/../tests/mail_test_helpers";
import { describe, expect, test } from "@odoo/hoot";
import {
    defineModels,
    fields,
    models,
    mountView,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { defineSMSModels } from "./sms_test_helpers"

describe.current.tags("desktop");
defineSMSModels();

class Partner extends models.Model {
    message = fields.Char();
    foo = fields.Char();
    mobile = fields.Char();
    partner_ids = fields.One2many( {relation: "partner" });

    _records = [
        {
            id: 1,
            message: "",
            foo: "yop",
            mobile: "+32494444444",
        },
        {
            id: 2,
            message: "",
            foo: "bayou",
        },
    ];
}
defineModels([Partner]);

class Visitor extends models.Model {
    mobile = fields.Char();

    _records = [{ id: 1, mobile: "+32494444444" }];

}
defineModels([Visitor]);


test("Sms button in form view", async () => {
    await mountView({
        type: "form",
        resModel: "visitor",
        resId: 1,
        arch: /* xml */ `
            <form>
                <sheet>
                    <field name="mobile" widget="phone"/>
                </sheet>
            </form>
        `
    })
    await contains(".o_field_phone a.o_field_phone_sms");
});

test("Sms button with option enable_sms set as False", async () => {
    await mountView({
        type: "form",
        resModel: "visitor",
        resId: 1,
        mode: "readonly",
        arch: `
            <form>
                <sheet>
                    <field name="mobile" widget="phone" options="{'enable_sms': false}"/>
                </sheet>
            </form>`,
    });
    await contains(".o_field_phone");
    await contains(".o_field_phone a.o_field_phone_sms", {count : 0});
});

test("click on the sms button while creating a new record in a FormView", async () => {
    const form = await mountView({
        type: "form",
        resModel: "partner",
        arch: `
            <form>
                <sheet>
                    <field name="foo"/>
                    <field name="mobile" widget="phone"/>
                </sheet>
            </form>`,
    });
    patchWithCleanup(form.env.services.action, {
        doAction: (action, options) => {
            expect(action.type).toBe("ir.actions.act_window");
            expect(action.type).toBe("sms.composer");
            options.onClose();
        },
    });
    await editInput(document.body, "[name='foo'] input", "John");
    await editInput(document.body, "[name='mobile'] input", "+32494444411");
    await click(document.body, ".o_field_phone_sms", { skipVisibilityCheck: true });
    expect($("[name='foo'] input").val()).toBe("John");
    expect($("[name='mobile'] input").val()).toBe("+32494444411");
});


test(
    "click on the sms button in a FormViewDialog has no effect on the main form view",
    async () => {
        const form = await mountView({
            type: "form",
            resModel: "partner",
            arch: `
                <form>
                    <sheet>
                        <field name="foo"/>
                        <field name="mobile" widget="phone"/>
                        <field name="partner_ids">
                        <kanban>
                            <field name="display_name"/>
                            <templates>
                                <t t-name="kanban-box">
                                    <div><t t-esc="record.display_name"/></div>
                                </t>
                            </templates>
                        </kanban>
                    </field>
                    </sheet>
                </form>`,
        });
        patchWithCleanup(form.env.services.action, {
            doAction: (action, options) => {
                expect(action.type).toBe("ir.actions.act_window");
                expect(action.res_model).toBe("sms.composer");
                options.onClose();
            },
        });
        await editInput(document.body, "[name='foo'] input", "John");
        await editInput(document.body, "[name='mobile'] input", "+32494444411");
        await click(".o-kanban-button-new");
        await contains(".modal");
        await editInput($(".modal")[0], "[name='foo'] input", "Max");
        await editInput($(".modal")[0], "[name='mobile'] input", "+324955555");
        await click($(".modal")[0], ".o_field_phone_sms", { skipVisibilityCheck: true });
        expect($(".modal [name='foo'] input").val()).toBe("Max");
        expect($(".modal [name='mobile'] input").val()).toBe("+324955555");

        await click($(".modal")[0], ".o_form_button_cancel");
        expect($("[name='foo'] input").val()).toBe("John");
        expect($("[name='mobile'] input").val()).toBe("+32494444411");
    }
);
