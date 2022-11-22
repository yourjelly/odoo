/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { registry } from "@web/core/registry";
import { AdvancedSelect } from "@web/core/advanced_select/advanced_select";
import { makeTestEnv } from "../helpers/mock_env";
import {
    getFixture,
    patchWithCleanup,
    mount,
    click,
    triggerEvent,
    editInput,
} from "../helpers/utils";

import { Component, useState, xml } from "@odoo/owl";

const serviceRegistry = registry.category("services");

QUnit.module("Web Components", (hooks) => {
    QUnit.module("Select Advanced");

    let env;
    let target;

    hooks.beforeEach(async () => {
        serviceRegistry.add("hotkey", hotkeyService);
        env = await makeTestEnv();
        target = getFixture();
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
        });
    });

    function getDefaultComponent() {
        class Parent extends Component {
            setup() {
                this.state = useState({ value: "Hello" });
            }
            onSelect(value) {
                this.state.value = value;
            }
        }
        Parent.components = { AdvancedSelect };
        Parent.template = xml`
        <AdvancedSelect
            groups="[{ options: ['World', 'Hello']}]"
            value="state.value"
            onSelect.bind="onSelect"
        />
    `;
        return Parent;
    }

    async function open() {
        if (target.querySelector(".o_advanced_select_toggler")) {
            await click(target, ".o_advanced_select_toggler");
        } else {
            await click(target, ".o_advanced_select");
        }
    }

    function getValue() {
        return target.querySelector(".o_advanced_select_toggler_slot").textContent;
    }

    QUnit.test("Can be rendered", async (assert) => {
        const Parent = getDefaultComponent();

        await mount(Parent, target, { env });
        assert.containsOnce(target, ".o_advanced_select");
        assert.containsOnce(target, ".o_advanced_select_toggler");

        await open();
        assert.containsOnce(target, ".o_advanced_select_menu");
        assert.containsNone(target, ".o_advanced_select_input");
        assert.containsN(target, ".o_advanced_select_item_label", 2);

        const options = [...target.querySelectorAll(".o_advanced_select_item_label")];
        assert.deepEqual(
            options.map((el) => el.textContent),
            ["World", "Hello"]
        );
    });

    QUnit.test("Default value correctly set", async (assert) => {
        const Parent = getDefaultComponent();

        await mount(Parent, target, { env });
        assert.strictEqual(getValue(), "Hello");
    });

    QUnit.test("Selecting an option calls onSelect and the displayed value is updated", async (assert) => {
        class Parent extends Component {
            setup() {
                this.state = useState({ value: "Hello" });
            }

            onSelect(value) {
                assert.step(value);
                this.state.value = value;
            }
        }
        Parent.components = { AdvancedSelect };
        Parent.template = xml`
            <AdvancedSelect
            groups="[{ options: ['World', 'Hello']}]"
                value="state.value"
                onSelect.bind="onSelect"
            />
        `;

        await mount(Parent, target, { env });
        assert.strictEqual(getValue(), "Hello");

        await open();
        await click(target.querySelectorAll(".o_advanced_select_item_label")[0]);
        assert.strictEqual(getValue(), "World");
        assert.verifySteps(["World"]);

        await open();
        await click(target.querySelectorAll(".o_advanced_select_item_label")[1]);
        assert.strictEqual(getValue(), "Hello");
        assert.verifySteps(["Hello"]);
    });

    QUnit.test("Close dropdown on click outside", async (assert) => {
        const Parent = getDefaultComponent();

        await mount(Parent, target, { env });
        assert.containsNone(target, ".o_advanced_select_menu");

        await open();
        assert.containsOnce(target, ".o_advanced_select_menu");

        await click(target, null);
        assert.containsNone(target, ".o_advanced_select_menu");
    });

    QUnit.test("Close dropdown on escape keydown", async (assert) => {
        const Parent = getDefaultComponent();

        await mount(Parent, target, { env });
        assert.containsNone(target, ".o_advanced_select_menu");

        await open();
        assert.containsOnce(target, ".o_advanced_select_menu");

        await triggerEvent(target, ".o_advanced_select_toggler", "keydown", { key: "Escape" });
        assert.containsNone(target, ".o_advanced_select_menu");
    });

    QUnit.test("Search input should not be present by default", async (assert) => {
        const Parent = getDefaultComponent();

        await mount(Parent, target, { env });
        await open();
        assert.containsNone(target, ".o_advanced_select_input");
    });

    QUnit.test("Search input should be present and auto-focused when search is enabled", async (assert) => {
        class Parent extends Component { }
        Parent.components = { AdvancedSelect };
        Parent.template = xml`
            <AdvancedSelect
                groups="[{ options: ['World', 'Hello']}]"
                searchable="true"
            />
        `;

        await mount(Parent, target, { env });
        await open();
        assert.containsOnce(target, ".o_advanced_select_input");
        assert.equal(document.activeElement, target.querySelector(".o_advanced_select_input input"));
    });

    QUnit.test("Search input value passed to groups options function", async (assert) => {
        class Parent extends Component {
            testFilter(searchString) {
                assert.step(searchString ? searchString : "empty");
                return ["World", "Hello"];
            }

            get groups() {
                return [{ options: this.testFilter }];
            }
        }
        Parent.components = { AdvancedSelect };
        Parent.template = xml`<AdvancedSelect groups="groups" searchable="true" />`;

        await mount(Parent, target, { env });
        await open();
        assert.verifySteps(["empty"]);
        assert.containsN(target, ".o_advanced_select_item_label", 2);

        await editInput(target, ".o_advanced_select_input input", "foo");
        assert.verifySteps(["foo"]);
        assert.containsN(target, ".o_advanced_select_item_label", 2);
    });

    QUnit.test(
        "Clear button calls 'onClear' and appears only when 'canClear' is true",
        async (assert) => {
            class Parent extends Component {
                setup() {
                    this.state = useState({ value: "Hello" });
                }
                onClear() {
                    assert.step("Cleared");
                    this.state.value = "No option selected";
                }
                canClear() {
                    return this.state.value !== "No option selected";
                }
            }
            Parent.components = { AdvancedSelect };
            Parent.template = xml`
            <AdvancedSelect
                groups="[{ options: ['World', 'Hello']}]"
                value="state.value"
                canClear="this.canClear()"
                onClear.bind="onClear"
            />
        `;

            await mount(Parent, target, { env });
            assert.containsOnce(target, ".o_advanced_select_toggler_clear");
            assert.strictEqual(getValue(), "Hello");

            await click(target.querySelector(".o_advanced_select_toggler_clear"));
            assert.verifySteps(["Cleared"]);
            assert.containsNone(target, ".o_advanced_select_toggler_clear");
            assert.strictEqual(getValue(), "No option selected");
        }
    );
});
