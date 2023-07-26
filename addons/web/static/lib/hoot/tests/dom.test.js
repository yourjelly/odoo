/** @odoo-module **/

import { getFixture, mountTemplate } from "@web/../tests/helpers/utils";
import {
    closest,
    getFocusableElements,
    getNextFocusableElement,
    getParentFrame,
    getPreviousFocusableElement,
    getRect,
    getScrollParent,
    getText,
    getTouchingElements,
    isDocument,
    isEditable,
    isElement,
    isEventTarget,
    isFocusable,
    isVisible,
    queryAll,
    queryOne,
} from "@web/core/utils/dom";
import { click } from "@web/core/utils/events";
import { suite, test } from "../setup";

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

suite("HOOT", "Helpers", "DOM", () => {
    test("closest", async (assert) => {
        await mountTemplate(/* xml */ `
            <div class="root position-relative" style="width:$800}px;height:${600}px">
                ${makeSquare({ left: 30, top: 30 }, "target a")}
                ${makeSquare({ left: 0, top: 0 }, "target b")}
                ${makeSquare({ left: 200, top: 100 }, "target c")}
            </div>
        `);

        const root = getFixture(".root");
        const targets = root.getElementsByClassName("target");
        const { x, y } = getRect(root);

        assert.equal(targets.length, 3);
        assert.hasClass(closest(targets, { x: x + 15, y: y + 15 }), "b");
        assert.hasClass(closest(targets, { x: x + 45, y: y + 45 }), "a");
        assert.hasClass(closest(targets, { x: x + 800, y: y + 0 }), "c");
    });

    test("getFocusableElements", async (assert) => {
        await mountTemplate(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        assert.deepEqual(
            getFocusableElements().map((el) => el.className),
            ["button", "input", "div"]
        );
    });

    test("getNextFocusableElement", async (assert) => {
        await mountTemplate(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        assert.hasClass(getNextFocusableElement(), "div");
    });

    test("getParentFrame", async (assert) => {
        await mountTemplate(/* xml */ `<div class="root" />`);

        const parent = await makeIframe(document, getFixture(".root"));
        const child = await makeIframe(parent.contentDocument);

        const content = child.contentDocument.createElement("div");
        child.contentDocument.body.appendChild(content);

        assert.equal(getParentFrame(content), child);
        assert.equal(getParentFrame(child), parent);
        assert.equal(getParentFrame(parent), null);
    });

    test("getPreviousFocusableElement", async (assert) => {
        await mountTemplate(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0" />
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        assert.hasClass(getPreviousFocusableElement(), "button");
    });

    test("getRect", async (assert) => {
        await mountTemplate(/* xml */ `
            <div class="root position-relative">
                ${makeSquare({ left: 10, top: 20, padding: 5 }, "target")}
            </div>
        `);

        const root = getFixture(".root");
        const { x, y } = getRect(root);
        const target = root.querySelector(".target");

        assert.deepEqual(getRect(target), new DOMRect(x + 10, y + 20, 30, 30));
        assert.deepEqual(
            getRect(getFixture(".target"), { trimPadding: true }),
            new DOMRect(x + 15, y + 25, 20, 20)
        );
    });

    test("getScrollParent", async (assert) => {
        await mountTemplate(FULL_HTML_TEMPLATE);

        assert.equal(getScrollParent(".highlighted", "x"), getFixture("main"));
        assert.equal(getScrollParent(".highlighted", "y"), getFixture("ul"));
    });

    test("getText", async (assert) => {
        await mountTemplate(FULL_HTML_TEMPLATE);

        assert.deepEqual(getText(".title"), ["Title", "List header", "Form title"]);
        assert.deepEqual(getText("footer"), ["Footer\nBack to top"]);
    });

    QUnit.skip("getTouchingElements", async (assert) => {
        assert.ok(getTouchingElements());
    });

    test("isDocument", async (assert) => {
        assert.ok(isDocument(document));
        assert.ok(isDocument((await makeIframe(document, getFixture())).contentDocument));
        assert.ok(isDocument(document.createElement("div").ownerDocument));
        assert.not.ok(isDocument(document.body));
        assert.not.ok(isDocument(window));
    });

    test("isEditable", async (assert) => {
        assert.ok(isEditable(document.createElement("input")));
        assert.ok(isEditable(document.createElement("textarea")));
        assert.not.ok(isEditable(document.createElement("select")));

        const editableDiv = document.createElement("div");
        assert.not.ok(isEditable(editableDiv));
        editableDiv.setAttribute("contenteditable", "true");
        assert.ok(isEditable(editableDiv));
    });

    test("isElement", async (assert) => {
        assert.ok(isElement(document.body));
        assert.ok(isElement(document.createElement("form")));
        assert.ok(isElement(document.createElementNS(SVG_URL, "svg")));
        assert.not.ok(isElement(window));
        assert.not.ok(isElement(document));
        assert.not.ok(isElement({}));
    });

    test("isEventTarget", async (assert) => {
        assert.ok(isEventTarget(window));
        assert.ok(isEventTarget(document));
        assert.ok(isEventTarget(document.body));
        assert.ok(isEventTarget(document.createElement("form")));
        assert.ok(isEventTarget(document.createElementNS(SVG_URL, "svg")));
        assert.not.ok(isEventTarget({}));
    });

    test("isFocusable", async (assert) => {
        await mountTemplate(FULL_HTML_TEMPLATE);

        assert.ok(isFocusable("input:first"));
        assert.not.ok(isFocusable("li:first"));
    });

    test("isVisible", async (assert) => {
        await mountTemplate(FULL_HTML_TEMPLATE);

        assert.ok(isVisible(window));
        assert.ok(isVisible(document));
        assert.ok(isVisible(document.body));
        assert.ok(isVisible("form"));
        assert.not.ok(isVisible(".d-none"));
    });

    test("queryAll", async (assert) => {
        /** @param {string} selector */
        const $$ = (selector, root = getFixture()) =>
            selector ? [...root.querySelectorAll(selector)] : [];

        await mountTemplate(FULL_HTML_TEMPLATE);

        const [iframe] = $$("iframe");

        await new Promise((resolve) => iframe.addEventListener("load", resolve));

        // Regular selectors
        assert.deepEqual(queryAll("body"), [document.body]);
        assert.deepEqual(queryAll("document"), [document.body]);
        assert.deepEqual(queryAll(".title"), $$(".title"));
        assert.deepEqual(queryAll("ul > li"), $$("ul > li"));
        assert.deepEqual(queryAll(), $$());

        // :first, :last & :eq
        assert.deepEqual(queryAll(".title:first"), [$$(".title").at(0)]);
        assert.deepEqual(queryAll(".title:last"), [$$(".title").at(-1)]);
        assert.deepEqual(queryAll(".title:eq(1)"), [$$(".title").at(1)]);

        // :contains
        assert.deepEqual(queryAll(".text:contains(text)"), $$("p"));
        assert.deepEqual(queryAll(".text:contains(item)"), $$("li"));

        // :value
        assert.deepEqual(queryAll("input:value(john)"), $$("[name=name],[name=email"));
        assert.deepEqual(queryAll("input:value(john doe)"), $$("[name=name]"));
        assert.deepEqual(queryAll("input:value(johndoe)"), $$("[name=email]"));
        assert.deepEqual(queryAll("select:value(mr)"), $$("[name=title]"));
        assert.deepEqual(queryAll("select:value(unknown value)"), $$());

        // :selected
        assert.deepEqual(
            queryAll("option:selected"),
            $$("select[name=title] option[value=mr],select[name=job] option:first-child")
        );

        // :iframe
        assert.deepEqual(queryAll("iframe p:contains(text)"), $$());
        assert.deepEqual(queryAll(":iframe p:contains(text)"), $$("p", iframe.contentDocument));
    });

    test("queryOne", async (assert) => {
        await mountTemplate(FULL_HTML_TEMPLATE);

        assert.equal(queryOne(".title:first"), getFixture().querySelector("header .title"));
        assert.throws(() => queryOne(".title"));
        assert.throws(() => queryOne(".title", { single: false }));
    });
});
