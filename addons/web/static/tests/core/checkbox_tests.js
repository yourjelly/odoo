/** @odoo-module **/

import { CheckBox } from "@web/core/checkbox/checkbox";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { translatedTerms } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { makeFakeLocalizationService } from "@web/../tests/helpers/mock_services";
import {
    click,
    getFixture,
    patchWithCleanup,
    mount,
    triggerEvent,
} from "@web/../tests/helpers/utils";

const { Component, useState, xml } = owl;
const serviceRegistry = registry.category("services");

let target;

QUnit.module("Components", (hooks) => {
    hooks.beforeEach(async () => {
        target = getFixture();
        serviceRegistry.add("hotkey", hotkeyService);
    });

    QUnit.module("CheckBox");

    QUnit.test("can be rendered", async (assert) => {
        const env = await makeTestEnv();
        await mount(CheckBox, target, { env, props: {} });
        assert.containsOnce(target, "div.custom-checkbox");
    });

    QUnit.test("has a slot for translatable text", async (assert) => {
        patchWithCleanup(translatedTerms, { ragabadabadaba: "rugubudubudubu" });
        serviceRegistry.add("localization", makeFakeLocalizationService());
        const env = await makeTestEnv();

        class Parent extends Component {}
        Parent.template = xml`<CheckBox>ragabadabadaba</CheckBox>`;
        Parent.components = { CheckBox };

        await mount(Parent, target, { env });
        assert.containsOnce(target, "div.custom-checkbox");
        assert.strictEqual(
            target.querySelector("div.custom-checkbox").textContent,
            "rugubudubudubu"
        );
    });

    QUnit.test("call onChange prop when some change occurs", async (assert) => {
        const env = await makeTestEnv();

        let value = false;
        class Parent extends Component {
            onChange(checked) {
                value = checked;
            }
        }
        Parent.template = xml`<CheckBox onChange="onChange"/>`;
        Parent.components = { CheckBox };

        await mount(Parent, target, { env });
        assert.containsOnce(target, "div.custom-checkbox");
        await click(target.querySelector("input"));
        assert.strictEqual(value, true);
        await click(target.querySelector("input"));
        assert.strictEqual(value, false);
    });

    QUnit.test("can toggle value by pressing ENTER", async (assert) => {
        const env = await makeTestEnv();
        class Parent extends Component {
            setup() {
                this.state = useState({ value: false });
            }
            onChange(checked) {
                this.state.value = checked;
            }
        }
        Parent.template = xml`<CheckBox onChange.bind="onChange" value="state.value"/>`;
        Parent.components = { CheckBox };

        await mount(Parent, target, { env });
        assert.containsOnce(target, "div.custom-checkbox");
        assert.notOk(target.querySelector("div.custom-checkbox input").checked);
        await triggerEvent(target, "div.custom-checkbox input", "keydown", { key: "Enter" });
        assert.ok(target.querySelector("div.custom-checkbox input").checked);
        await triggerEvent(target, "div.custom-checkbox input", "keydown", { key: "Enter" });
        assert.notOk(target.querySelector("div.custom-checkbox input").checked);
    });
});
