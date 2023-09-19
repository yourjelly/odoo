/** @odoo-module **/

import { queryOne } from "../../helpers/dom";
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
} from "../../helpers/events";
import { suite, test } from "../../setup";
import { mount } from "../local_helpers";

/**
 *
 * @param {HTMLElement} element
 * @param {import("@web/core/utils/events").EventType} type
 */
function addStepListener(element, type) {
    return on(element, type, (event) => QUnit.expect.step(event.type));
}

suite.skip("@odoo/hoot", "Helpers", "Events", () => {
    test("clear", async (expect) => {
        await mount(/* xml */ `<input value="Test" />`);

        const input = queryOne("input");
        expect.equal(input.value, "Test");

        click(input);
        clear();

        expect.equal(input.value, "");
    });

    test("click", async (expect) => {
        await mount(/* xml */ `<button>Click me</button>`);

        addStepListener("button", "type");

        click("button");
        expect.ok(click());
    });

    test.skip("drag", async (expect) => {
        expect.ok(drag());
    });

    test.skip("fill", async (expect) => {
        await mount(/* xml */ `<input value="Test" />`);

        expect.equal(queryOne("input"), "Test");

        fill("input", " value");

        expect.equal(queryOne("input"), "Test value");
    });

    test.skip("hover", async (expect) => {
        expect.ok(hover());
    });

    test.skip("keyDown", async (expect) => {
        expect.ok(keyDown());
    });

    test.skip("keyUp", async (expect) => {
        expect.ok(keyUp());
    });

    test.skip("leave", async (expect) => {
        expect.ok(leave());
    });

    test.skip("on", async (expect) => {
        expect.ok(on());
    });

    test.skip("pointerDown", async (expect) => {
        expect.ok(pointerDown());
    });

    test.skip("pointerUp", async (expect) => {
        expect.ok(pointerUp());
    });

    test.skip("press", async (expect) => {
        expect.ok(press());
    });

    test.skip("scroll", async (expect) => {
        expect.ok(scroll());
    });

    test.skip("select", async (expect) => {
        expect.ok(select());
    });
});
