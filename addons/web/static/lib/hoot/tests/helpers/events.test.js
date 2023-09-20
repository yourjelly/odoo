/** @odoo-module */

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
import { describe, expect, test } from "../../hoot";
import { mount } from "../local_helpers";

/**
 *
 * @param {HTMLElement} element
 * @param {import("@web/core/utils/events").EventType} type
 */
function addStepListener(element, type) {
    return on(element, type, (event) => QUnit.expect.step(event.type));
}

describe.skip("@odoo/hoot", "Helpers", "Events", () => {
    test("clear", async () => {
        await mount(/* xml */ `<input value="Test" />`);

        const input = queryOne("input");
        expect(input.value).toBe("Test");

        click(input);
        clear();

        expect(input.value).toBe("");
    });

    test("click", async () => {
        await mount(/* xml */ `<button>Click me</button>`);

        addStepListener("button", "type");

        click("button");
        expect(click()).toBeTruthy();
    });

    test.skip("drag", async () => {
        expect.ok(drag());
    });

    test.skip("fill", async () => {
        await mount(/* xml */ `<input value="Test" />`);

        expect(queryOne("input")).toBe("Test");

        fill("input", " value");

        expect(queryOne("input")).toBe("Test value");
    });

    test.skip("hover", async () => {
        expect(hover()).toBeTruthy();
    });

    test.skip("keyDown", async () => {
        expect(keyDown()).toBeTruthy();
    });

    test.skip("keyUp", async () => {
        expect(keyUp()).toBeTruthy();
    });

    test.skip("leave", async () => {
        expect(leave()).toBeTruthy();
    });

    test.skip("on", async () => {
        expect(on()).toBeTruthy();
    });

    test.skip("pointerDown", async () => {
        expect(pointerDown()).toBeTruthy();
    });

    test.skip("pointerUp", async () => {
        expect(pointerUp()).toBeTruthy();
    });

    test.skip("press", async () => {
        expect(press()).toBeTruthy();
    });

    test.skip("scroll", async () => {
        expect(scroll()).toBeTruthy();
    });

    test.skip("select", async () => {
        expect(select()).toBeTruthy();
    });
});
