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

describe("@odoo/hoot/helpers", "Events", () => {
    test("clear", async () => {
        await mount(/* xml */ `<input value="Test" />`);

        const input = queryOne("input");
        const exepctedEvents = [
            "pointerdown",
            "mousedown",
            "focus",
            "pointerup",
            "mouseup",
            "click",
            "keydown",
            "keyup",
            "keypress",
            "input",
            "change",
        ];
        for (const evType of exepctedEvents) {
            on(input, evType, (ev) => expect.step(ev.type));
        }

        expect(input.value).toBe("Test");

        const events = [...click(input), ...clear()];

        expect(input.value).toBe("");
        expect(events.map((ev) => ev.type)).toEqual(exepctedEvents);
        expect(exepctedEvents).toVerifySteps();
    });

    test("click", async () => {
        await mount(/* xml */ `<button>Click me</button>`);

        const exepctedEvents = [
            "pointerdown",
            "mousedown",
            "focus",
            "pointerup",
            "mouseup",
            "click",
        ];
        for (const evType of exepctedEvents) {
            on("button", evType, (ev) => expect.step(ev.type));
        }

        const events = click("button");

        expect(events.map((ev) => ev.type)).toEqual(exepctedEvents);
        expect(exepctedEvents).toVerifySteps();
    });

    test.skip("drag", async () => {
        expect(drag()).toBeTruthy();
    });

    test("fill", async () => {
        await mount(/* xml */ `<input value="Test" />`);

        const input = queryOne("input");
        expect(input.value).toBe("Test");

        click("input");
        fill("Test value");

        expect(input.value).toBe("Test value");
    });

    test.skip("hover", async () => {
        await mount(/* xml */ `<button>Click me</button>`);

        on("button", "pointerenter", (ev) => expect.step(ev.type));

        hover("button");

        expect(["pointerenter"]).toVerifySteps();
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
