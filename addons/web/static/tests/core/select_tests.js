/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { registry } from "@web/core/registry";
import { Select } from "@web/core/select/select";
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

let env;
let target;

function nativeSelect() {
    class Parent extends Component {}
    Parent.components = { Select };
    Parent.template = xml`
        <Select options="['World', 'Hello']" value="'Hello'"/>
    `;
    return Parent;
}

function customSelect() {
    class Parent extends Component {
        setup() {
            this.state = useState({ value: "Hello" });
        }
        onSelect(value) {
            this.state.value = value;
        }
    }
    Parent.components = { Select };
    Parent.template = xml`
        <Select
            options="['World', 'Hello']"
            value="state.value"
            forceCustom="true"
            onSelect.bind="onSelect"
        />
    `;
    return Parent;
}

async function open() {
    if (target.querySelector(".o_select_toggler")) {
        await click(target, ".o_select_toggler");
    } else {
        await click(target, ".o_select");
    }
}

function getValueNative() {
    return target.querySelector("option:checked").textContent;
}

function getValueCustom() {
    return target.querySelector(".o_select_toggler_slot").textContent;
}

QUnit.module("Components", (hooks) => {
    hooks.beforeEach(async () => {
        serviceRegistry.add("hotkey", hotkeyService);
        env = await makeTestEnv();
        target = getFixture();
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
        });
    });

    QUnit.module("Select");

    QUnit.test("Native > Can be rendered", async (assert) => {
        const Parent = nativeSelect();

        await mount(Parent, target, { env });
        assert.containsOnce(target, ".o_select");
        assert.containsNone(target, ".o_select_toggler");

        await open();
        assert.containsNone(target, ".o_select_menu");
        assert.containsN(target, ".o_select option", 2);

        const options = [...target.querySelectorAll(".o_select option")];
        assert.deepEqual(
            options.map((el) => el.textContent),
            ["World", "Hello"]
        );
    });

    QUnit.test("Native > Use native select when using basic options", async (assert) => {
        const Parent = nativeSelect();

        await mount(Parent, target, { env });
        assert.containsOnce(target, "select");
        assert.containsNone(target, ".o_select_toggler");
    });

    QUnit.test("Native > Default value correctly set", async (assert) => {
        const Parent = nativeSelect();

        await mount(Parent, target, { env });
        assert.strictEqual(getValueNative(), "Hello");
    });

    QUnit.test("Custom > Can be rendered", async (assert) => {
        const Parent = customSelect();

        await mount(Parent, target, { env });
        assert.containsOnce(target, ".o_select");
        assert.containsOnce(target, ".o_select_toggler");

        await open();
        assert.containsOnce(target, ".o_select_menu");
        assert.containsNone(target, ".o_select_input");
        assert.containsN(target, ".o_select_item_label", 2);

        const options = [...target.querySelectorAll(".o_select_item_label")];
        assert.deepEqual(
            options.map((el) => el.textContent),
            ["World", "Hello"]
        );
    });

    QUnit.test("Custom > Use custom select when searchable is enabled", async (assert) => {
        class Parent extends Component {}
        Parent.components = { Select };
        Parent.template = xml`<Select options="['World', 'Hello']" searchable="true" />`;

        await mount(Parent, target, { env });
        assert.containsNone(target, "select");
        assert.containsOnce(target, ".o_select_toggler");
    });

    QUnit.test("Custom > Use custom select when using custom toggler", async (assert) => {
        class Parent extends Component {}
        Parent.components = { Select };
        Parent.template = xml`
            <Select options="['World', 'Hello']">
                <span>Test</span>
            </Select>
        `;

        await mount(Parent, target, { env });
        assert.containsNone(target, "select");
        assert.containsOnce(target, ".o_select_toggler");
    });

    QUnit.test("Custom > Use custom select when 'canDelete' is true", async (assert) => {
        class Parent extends Component {}
        Parent.components = { Select };
        Parent.template = xml`
            <Select options="['World', 'Hello']" canDelete="true"/>
        `;

        await mount(Parent, target, { env });
        assert.containsNone(target, "select");
        assert.containsOnce(target, ".o_select_toggler");
    });

    QUnit.test("Custom > Default value correctly set", async (assert) => {
        const Parent = customSelect();

        await mount(Parent, target, { env });
        assert.strictEqual(getValueCustom(), "Hello");
    });

    QUnit.test("Custom > Select option", async (assert) => {
        class Parent extends Component {
            setup() {
                this.state = useState({ value: "Hello" });
            }

            onSelect(value) {
                assert.step(value);
                this.state.value = value;
            }
        }
        Parent.components = { Select };
        Parent.template = xml`
            <Select
                options="['World', 'Hello']"
                value="state.value"
                forceCustom="true"
                onSelect.bind="onSelect"
            />
        `;

        await mount(Parent, target, { env });
        assert.strictEqual(getValueCustom(), "Hello");

        await open();
        await click(target.querySelectorAll(".o_select_item_label")[0]);
        assert.strictEqual(getValueCustom(), "World");
        assert.verifySteps(["World"]);

        await open();
        await click(target.querySelectorAll(".o_select_item_label")[1]);
        assert.strictEqual(getValueCustom(), "Hello");
        assert.verifySteps(["Hello"]);
    });

    QUnit.test("Custom > Close dropdown on click outside", async (assert) => {
        const Parent = customSelect();

        await mount(Parent, target, { env });
        assert.containsNone(target, ".o_select_menu");

        await open();
        assert.containsOnce(target, ".o_select_menu");

        await click(target, null);
        assert.containsNone(target, ".o_select_menu");
    });

    QUnit.test("Custom > Close dropdown on escape keydown", async (assert) => {
        const Parent = customSelect();

        await mount(Parent, target, { env });
        assert.containsNone(target, ".o_select_menu");

        await open();
        assert.containsOnce(target, ".o_select_menu");

        await triggerEvent(target, ".o_select_toggler", "keydown", { key: "Escape" });
        assert.containsNone(target, ".o_select_menu");
    });

    QUnit.test("Custom > Search input should not be present by default", async (assert) => {
        const Parent = customSelect();

        await mount(Parent, target, { env });
        await open();
        assert.containsNone(target, ".o_select_input");
    });

    QUnit.test(
        "Custom > Search input should be present and autofocused when search is enabled",
        async (assert) => {
            class Parent extends Component {}
            Parent.components = { Select };
            Parent.template = xml`
            <Select
                options="['World', 'Hello']"
                forceCustom="true"
                searchable="true"
            />
        `;

            await mount(Parent, target, { env });
            await open();
            assert.containsOnce(target, ".o_select_input");
        }
    );

    QUnit.test("Custom > Search input value passed to sources options function", async (assert) => {
        class Parent extends Component {
            testFilter(searchString) {
                assert.step(searchString ? searchString : "empty");
                return ["World", "Hello"];
            }

            get sources() {
                return [{ options: this.testFilter }];
            }
        }
        Parent.components = { Select };
        Parent.template = xml`<Select sources="sources" searchable="true" />`;

        await mount(Parent, target, { env });
        await open();
        assert.verifySteps(["empty", "empty"]);
        assert.containsN(target, ".o_select_item_label", 2);

        await editInput(target, ".o_select_input input", "foo");
        assert.verifySteps(["foo"]);
        assert.containsN(target, ".o_select_item_label", 2);
    });

    QUnit.test(
        "Custom > Delete button calls 'onDelete' and appears only when 'canDelete' is true",
        async (assert) => {
            class Parent extends Component {
                setup() {
                    this.state = useState({ value: "Hello" });
                }
                onDelete() {
                    assert.step("Deleted");
                    this.state.value = "No option selected";
                }
                canDelete() {
                    return this.state.value !== "No option selected";
                }
            }
            Parent.components = { Select };
            Parent.template = xml`
            <Select
                options="['World', 'Hello']"
                value="state.value"
                canDelete="canDelete()"
                onDelete.bind="onDelete"
            />
        `;

            await mount(Parent, target, { env });
            assert.containsOnce(target, ".o_select_toggler_delete");
            assert.strictEqual(getValueCustom(), "Hello");

            await click(target.querySelector(".o_select_toggler_delete"));
            assert.verifySteps(["Deleted"]);
            assert.containsNone(target, ".o_select_toggler_delete");
            assert.strictEqual(getValueCustom(), "No option selected");
        }
    );
});
