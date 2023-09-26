/** @odoo-module */

import {
    getFocusableElements,
    getNextFocusableElement,
    getParentFrame,
    getPreviousFocusableElement,
    getRect,
    getText,
    isDocument,
    isEditable,
    isElement,
    isEventTarget,
    isFocusable,
    isVisible,
    queryAll,
    queryOne,
} from "../../helpers/dom";
import { click } from "../../helpers/events";
import { describe, expect, test } from "../../hoot";
import { mount } from "../local_helpers";

/**
 * @param {Document} document
 * @param {HTMLElement} [root]
 * @returns {Promise<HTMLIFrameElement>}
 */
function makeIframe(document, root) {
    return new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.addEventListener("load", () => resolve(iframe));
        iframe.srcdoc = "<body></body>";
        (root || document.body).appendChild(iframe);
    });
}

/**
 * @param {Partial<DOMRect>} dimensions
 * @param {string} [className]
 */
function makeSquare(dimensions, className) {
    const style = Object.entries({ width: 30, height: 30, ...dimensions })
        .map(([k, v]) => `${k}:${v}px`)
        .join(";");
    return /* xml */ `
        <div
            class="position-absolute ${className}"
            style="${style}"
        />
    `;
}

const FULL_HTML_TEMPLATE = /* xml */ `
    <header>
        <h1 class="title">Title</h1>
    </header>
    <main class="overflow-auto" style="max-width: 100px">
        <h5 class="title">List header</h5>
        <ul class="overflow-auto" style="max-height: 80px">
            <li class="text highlighted">First item</li>
            <li class="text">Second item</li>
            <li class="text">Last item</li>
        </ul>
        <p class="text">Paragraph with some long text</p>
        <div class="d-none">Invisible section</div>
        <svg />
        <form>
            <h5 class="title">Form title</h5>
            <input name="name" type="text" t-att-value="'John Doe'" />
            <input name="email" type="email" t-att-value="'johndoe@sample.com'" />
            <select name="title" t-att-value="'mr'">
                <option selected="selected">Select an option</option>
                <option value="mr">Mr.</option>
                <option value="mrs">Mrs.</option>
                </select>
            <select name="job">
                <option selected="selected">Select an option</option>
                <option value="employer">Employer</option>
                <option value="employee">Employee</option>
            </select>
            <button type="submit">Submit</button>
            <button type="submit" disabled="disabled">Cancel</button>
        </form>
        <iframe srcdoc="&lt;p&gt;Iframe text content&lt;/p&gt;" />
    </main>
    <footer>
        <em>Footer</em>
        <button type="button">Back to top</button>
    </footer>
    `;
const SVG_URL = "http://www.w3.org/2000/svg";

describe.ui("@odoo/hoot/helpers", "DOM", () => {
    test("getFocusableElements", async () => {
        await mount(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        expect(getFocusableElements().map((el) => el.className)).toEqual([
            "button",
            "input",
            "div",
        ]);
    });

    test("getNextFocusableElement", async () => {
        await mount(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        expect(getNextFocusableElement()).toHaveClass("div");
    });

    test("getParentFrame", async () => {
        await mount(/* xml */ `<div class="root" />`);

        const parent = await makeIframe(document, queryOne(".root"));
        const child = await makeIframe(parent.contentDocument);

        const content = child.contentDocument.createElement("div");
        child.contentDocument.body.appendChild(content);

        expect(getParentFrame(content)).toBe(child);
        expect(getParentFrame(child)).toBe(parent);
        expect(getParentFrame(parent)).toBe(null);
    });

    test("getPreviousFocusableElement", async () => {
        await mount(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        expect(getPreviousFocusableElement()).toHaveClass("button");
    });

    test("getRect", async () => {
        await mount(/* xml */ `
            <div class="root position-relative">
                ${makeSquare({ left: 10, top: 20, padding: 5 }, "target")}
            </div>
        `);

        const root = queryOne(".root");
        const { x, y } = getRect(root);
        const target = root.querySelector(".target");

        expect(getRect(target)).toEqual(new DOMRect(x + 10, y + 20, 30, 30));
        expect(getRect(queryOne(".target"), { trimPadding: true })).toEqual(
            new DOMRect(x + 15, y + 25, 20, 20)
        );
    });

    test("getText", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(getText(".title")).toEqual(["Title", "List header", "Form title"]);
        expect(getText("footer")).toEqual(["Footer\nBack to top"]);
    });

    test("isDocument", async () => {
        expect(isDocument(document)).toBeTruthy();
        expect(isDocument((await makeIframe(document)).contentDocument)).toBeTruthy();
        expect(isDocument(document.createElement("div").ownerDocument)).toBeTruthy();
        expect(isDocument(document.body)).not.toBeTruthy();
        expect(isDocument(window)).not.toBeTruthy();
    });

    test("isEditable", async () => {
        expect(isEditable(document.createElement("input"))).toBeTruthy();
        expect(isEditable(document.createElement("textarea"))).toBeTruthy();
        expect(isEditable(document.createElement("select"))).not.toBeTruthy();

        const editableDiv = document.createElement("div");
        expect(isEditable(editableDiv)).not.toBeTruthy();
        editableDiv.setAttribute("contenteditable", "true");
        expect(isEditable(editableDiv)).toBeTruthy();
    });

    test("isElement", async () => {
        expect(isElement(document.body)).toBeTruthy();
        expect(isElement(document.createElement("form"))).toBeTruthy();
        expect(isElement(document.createElementNS(SVG_URL, "svg"))).toBeTruthy();
        expect(isElement(window)).not.toBeTruthy();
        expect(isElement(document)).not.toBeTruthy();
        expect(isElement({})).not.toBeTruthy();
    });

    test("isEventTarget", async () => {
        expect(isEventTarget(window)).toBeTruthy();
        expect(isEventTarget(document)).toBeTruthy();
        expect(isEventTarget(document.body)).toBeTruthy();
        expect(isEventTarget(document.createElement("form"))).toBeTruthy();
        expect(isEventTarget(document.createElementNS(SVG_URL, "svg"))).toBeTruthy();
        expect(isEventTarget({})).not.toBeTruthy();
    });

    test("isFocusable", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(isFocusable("input:first")).toBeTruthy();
        expect(isFocusable("li:first")).not.toBeTruthy();
    });

    test("isVisible", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(isVisible(window)).toBeTruthy();
        expect(isVisible(document)).toBeTruthy();
        expect(isVisible(document.body)).toBeTruthy();
        expect(isVisible("form")).toBeTruthy();
        expect(isVisible(".d-none")).not.toBeTruthy();
    });

    test("queryAll", async () => {
        /** @param {string} selector */
        const $$ = (selector, root = queryOne()) =>
            selector ? [...root.querySelectorAll(selector)] : [];

        await mount(FULL_HTML_TEMPLATE);

        const [iframe] = $$("iframe");

        await new Promise((resolve) => iframe.addEventListener("load", resolve));

        // Regular selectors
        expect(queryAll("body")).toEqual([document.body]);
        expect(queryAll("document")).toEqual([document.body]);
        expect(queryAll(".title")).toEqual($$(".title"));
        expect(queryAll("ul > li")).toEqual($$("ul > li"));
        expect(queryAll()).toEqual($$());

        // :first, :last & :eq
        expect(queryAll(".title:first")).toEqual([$$(".title").at(0)]);
        expect(queryAll(".title:last")).toEqual([$$(".title").at(-1)]);
        expect(queryAll(".title:eq(1)")).toEqual([$$(".title").at(1)]);

        // :contains
        expect(queryAll(".text:contains(text)")).toEqual($$("p"));
        expect(queryAll(".text:contains(item)")).toEqual($$("li"));

        // :value
        expect(queryAll("input:value(john)")).toEqual($$("[name=name],[name=email"));
        expect(queryAll("input:value(john doe)")).toEqual($$("[name=name]"));
        expect(queryAll("input:value(johndoe)")).toEqual($$("[name=email]"));
        expect(queryAll("select:value(mr)")).toEqual($$("[name=title]"));
        expect(queryAll("select:value(unknown value)")).toEqual($$());

        // :selected
        expect(queryAll("option:selected")).toEqual(
            $$("select[name=title] option[value=mr],select[name=job] option:first-child")
        );

        // :iframe
        expect(queryAll("iframe p:contains(text)")).toEqual($$());
        expect(queryAll(":iframe p:contains(text)")).toEqual($$("p", iframe.contentDocument));
    });

    test("queryOne", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(queryOne(".title:first")).toBe(queryOne().querySelector("header .title"));
        expect(() => queryOne(".title")).toThrow();
        expect(() => queryOne(".title", { single: false })).toThrow();
    });
});
