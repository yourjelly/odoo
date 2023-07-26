/** @odoo-module **/

import { mountTemplate } from "@web/../tests/helpers/utils";
import { queryOne } from "@web/core/utils/dom";
import {
    clear,
    click,
    drag,
    fill,
    hover,
    keyDown,
    keyUp,
    leave,
    on,
    pointerDown,
    pointerUp,
    press,
    scroll,
    select,
} from "../helpers/events";
import { suite, test } from "../setup";

/**
 *
 * @param {HTMLElement} element
 * @param {import("@web/core/utils/events").EventType} type
 */
function addStepListener(element, type) {
    return on(element, type, (event) => QUnit.assert.step(event.type));
}

suite("HOOT", "Helpers", "Events", () => {
    test("clear", async (assert) => {
        await mountTemplate(/* xml */ `<input value="Test" />`);

        assert.equal(queryOne("input"), "Test");

        clear("input");

        assert.equal(queryOne("input"), "");
    });

    test("click", async (assert) => {
        await mountTemplate(/* xml */ `<button>Click me</button>`);

        addStepListener("button", "type");

        click("button");
        assert.ok(click());
    });

    test.skip("drag", async (assert) => {
        assert.ok(drag());
    });

    test.skip("fill", async (assert) => {
        await mountTemplate(/* xml */ `<input value="Test" />`);

        assert.equal(queryOne("input"), "Test");

        fill("input", " value");

        assert.equal(queryOne("input"), "Test value");
    });

    test.skip("hover", async (assert) => {
        assert.ok(hover());
    });

    test.skip("keyDown", async (assert) => {
        assert.ok(keyDown());
    });

    test.skip("keyUp", async (assert) => {
        assert.ok(keyUp());
    });

    test.skip("leave", async (assert) => {
        assert.ok(leave());
    });

    test.skip("on", async (assert) => {
        assert.ok(on());
    });

    test.skip("pointerDown", async (assert) => {
        assert.ok(pointerDown());
    });

    test.skip("pointerUp", async (assert) => {
        assert.ok(pointerUp());
    });

    test.skip("press", async (assert) => {
        assert.ok(press());
    });

    test.skip("scroll", async (assert) => {
        assert.ok(scroll());
    });

    test.skip("select", async (assert) => {
        assert.ok(select());
    });
});
