/** @odoo-module */

import { describe, expect, getFixture, test } from "@odoo/hoot";
import {
    getFocusableElements,
    getNextFocusableElement,
    getParentFrame,
    getPreviousFocusableElement,
    getRect,
    isEditable,
    isEventTarget,
    isFocusable,
    isVisible,
    queryAll,
    queryAllContents,
    queryOne,
} from "@web/../lib/hoot-dom/helpers/dom";
import { click } from "@web/../lib/hoot-dom/helpers/events";
import { mount, parseUrl } from "../local_helpers";

/**
 * {@link document.querySelectorAll} shorthand
 * @param {string} selector
 */
const $$ = (selector) => [...getFixture().querySelectorAll(selector)];

/**
 * @param {...string} selectors
 */
const expectSelector = (...selectors) => {
    /**
     * @param {Node[] | string} nodes
     */
    const toMatch = (nodes) => {
        nodes ||= [];
        if (typeof nodes === "string") {
            nodes = $$(nodes);
        }
        expect(queriedNodes).toEqual(nodes, {
            message: `"${selector}" should match ${nodes.length} nodes`,
        });
    };

    const selector = selectors.join(", ");
    const queriedNodes = queryAll(selector);

    return { toMatch };
};

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
    <main id="custom-html">
        <h5 class="title">List header</h5>
        <ul colspan="1" class="overflow-auto" style="max-height: 80px">
            <li class="text highlighted">First item</li>
            <li class="text">Second item</li>
            <li class="text">Last item</li>
        </ul>
        <p colspan="2" class="text">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur justo
            velit, tristique vitae neque a, faucibus mollis dui. Aliquam iaculis
            sodales mi id posuere. Proin malesuada bibendum pellentesque. Phasellus
            mattis at massa quis gravida. Morbi luctus interdum mi, quis dapibus
            augue. Vivamus condimentum nunc mi, vitae suscipit turpis dictum nec.
            Sed varius diam dui, eget ultricies ante dictum ac.
        </p>
        <div class="d-none">Invisible section</div>
        <svg />
        <form class="overflow-auto" style="max-width: 100px">
            <h5 class="title">Form title</h5>
            <input name="name" type="text" value="John Doe (JOD)" />
            <input name="email" type="email" value="johndoe@sample.com" />
            <select name="title" value="mr">
                <option>Select an option</option>
                <option value="mr" selected="selected">Mr.</option>
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
        <iframe srcdoc="&lt;p&gt;Iframe text content&lt;/p&gt;"></iframe>
    </main>
    <footer>
        <em>Footer</em>
        <button type="button">Back to top</button>
    </footer>
    `;
const SVG_URL = "http://www.w3.org/2000/svg";

describe(parseUrl(import.meta.url), () => {
    test("getFocusableElements", async () => {
        await mount(/* xml */ `
            <input class="input" />
            <div class="div" tabindex="0">aaa</div>
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
            <div class="div" tabindex="0">aaa</div>
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
            <div class="div" tabindex="0">aaa</div>
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

    test("isEditable", async () => {
        expect(isEditable(document.createElement("input"))).toBe(true);
        expect(isEditable(document.createElement("textarea"))).toBe(true);
        expect(isEditable(document.createElement("select"))).toBe(false);

        const editableDiv = document.createElement("div");
        expect(isEditable(editableDiv)).toBe(false);
        editableDiv.setAttribute("contenteditable", "true");
        expect(isEditable(editableDiv)).toBe(true);
    });

    test("isEventTarget", async () => {
        expect(isEventTarget(window)).toBe(true);
        expect(isEventTarget(document)).toBe(true);
        expect(isEventTarget(document.body)).toBe(true);
        expect(isEventTarget(document.createElement("form"))).toBe(true);
        expect(isEventTarget(document.createElementNS(SVG_URL, "svg"))).toBe(true);
        expect(isEventTarget({})).toBe(false);
    });

    test("isFocusable", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(isFocusable("input:first")).toBe(true);
        expect(isFocusable("li:first")).toBe(false);
    });

    test("isVisible", async () => {
        await mount(FULL_HTML_TEMPLATE);

        expect(isVisible(document)).toBe(true);
        expect(isVisible(document.body)).toBe(true);
        expect(isVisible("form")).toBe(true);
        expect(isVisible(".d-none")).toBe(false);
    });

    describe("queryAll", () => {
        test("native selectors", async () => {
            mount(FULL_HTML_TEMPLATE);

            // sanity check for the helper functions
            expect($$("#custom-html")).toEqual([document.getElementById("custom-html")]);

            // Use as a template literal
            expect(queryAll``).toEqual([]);
            expect(queryAll`main`).toEqual($$("main"));
            expect(queryAll`.${"title"}`).toEqual($$(".title"));
            expect(queryAll`${"ul"}${" "}${`${"li"}`}`).toEqual($$(".title"));

            // Use as a regular function
            expectSelector().toMatch([]);
            expectSelector(".title").toMatch(".title");
            expectSelector("ul > li").toMatch("ul > li");
            expectSelector(
                "form:has(.title:not(.haha)):not(.huhu) input[name='email']:enabled"
            ).toMatch("[name=email]");
            expectSelector("[colspan='1']").toMatch("[colspan='1']");
        });

        test("custom pseudo-classes", async () => {
            await mount(FULL_HTML_TEMPLATE);

            await new Promise((resolve) => $$("iframe")[0].addEventListener("load", resolve));

            // :first, :last & :eq
            expectSelector(".title:first").toMatch([$$(".title").at(0)]);
            expectSelector(".title:last").toMatch([$$(".title").at(-1)]);
            expectSelector(".title:eq(1)").toMatch([$$(".title").at(1)]);
            expectSelector(".title:eq('1')").toMatch([$$(".title").at(1)]);
            expectSelector('.title:eq("1")').toMatch([$$(".title").at(1)]);

            // :contains (text)
            expectSelector("main > .text:contains(ipsum)").toMatch("p");
            expectSelector(".text:contains(/\\bL\\w+\\b\\sipsum/)").toMatch("p");
            expectSelector(".text:contains(item)").toMatch("li");

            // :contains (value)
            expectSelector("input:contains(john)").toMatch("[name=name],[name=email]");
            expectSelector("input:contains(john doe)").toMatch("[name=name]");
            expectSelector("input:contains('John Doe (JOD)')").toMatch("[name=name]");
            expectSelector(`input:contains("(JOD)")`).toMatch("[name=name]");
            expectSelector("input:contains(johndoe)").toMatch("[name=email]");
            expectSelector("select:contains(mr)").toMatch("[name=title]");
            expectSelector("select:contains(unknown value)").toMatch([]);

            // :selected
            expectSelector("option:selected").toMatch(
                "select[name=title] option[value=mr],select[name=job] option:first-child"
            );

            // :iframe
            expectSelector("iframe p:contains(iframe text content)").toMatch([]);
            expectSelector(":iframe p:contains(iframe text content)").toMatch([
                ...$$("iframe")[0].contentDocument.querySelectorAll("p"),
            ]);
        });

        test("advanced use cases", async () => {
            mount(FULL_HTML_TEMPLATE);

            // Comma-separated selectors
            expectSelector("p:contains(ipsum),:has(form:contains('Form title'))").toMatch("p,main");

            // :has & :not combinations with custom pseudo-classes
            expectSelector(`select:has(:contains(Employer))`).toMatch("select[name=job]");
            expectSelector(`select:not(:has(:contains(Employer)))`).toMatch("select[name=title]");
            expectSelector(
                `main:first-of-type:not(:has(:contains(This text does not exist))):contains('List header') > form:has([name="name"]):contains("Form title"):nth-child(6).overflow-auto:visible select[name=job] option:selected`
            ).toMatch("select[name=job] option:first-child");

            // :contains & commas
            expectSelector(`p:contains(velit,)`).toMatch("p");
            expectSelector(`p:contains('velit,')`).toMatch("p");
            expectSelector(`p:contains(", tristique")`).toMatch("p");
            expectSelector(`p:contains(/\\bvelit,/)`).toMatch("p");

            // Whatever, at this point I'm just copying failing selectors and creating
            // contexts accordingly as I'm fixing them.

            mount(/* xml */ `
                <div class="o_we_customize_panel">
                    <we-customizeblock-option class="snippet-option-ImageTools">
                        <div class="o_we_so_color_palette o_we_widget_opened">
                            idk
                        </div>
                        <we-select data-name="shape_img_opt">
                            <we-toggler />
                        </we-select>
                    </we-customizeblock-option>
                </div>
            `);
            expectSelector(
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] [title='we-select[data-name="shape_img_opt"] we-toggler']`
            ).toMatch([]);

            mount(/* xml */ `
                <div class="o_we_customize_panel">
                    <we-customizeblock-option class="snippet-option-ImageTools">
                        <we-select data-name="shape_img_opt">
                            <we-toggler />
                        </we-select>
                    </we-customizeblock-option>
                </div>
            `);
            expectSelector(
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] [title='we-select[data-name="shape_img_opt"] we-toggler']`
            ).toMatch("we-toggler");

            mount(/* xml */ `
                <div class="o_we_customize_panel">
                    <we-customizeblock-option class="snippet-option-ImageTools">
                        <div title='we-select[data-name="shape_img_opt"] we-toggler'>
                            idk
                        </div>
                    </we-customizeblock-option>
                </div>
            `);
            expectSelector(
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] [title='we-select[data-name="shape_img_opt"] we-toggler']`
            ).toMatch("div[title]");

            mount(/* xml */ `
                <div class="o_menu_sections">
                    <a class="dropdown-item">Products</a>
                </div>
                <nav class="o_burger_menu_content">
                    <ul>
                        <li data-menu-xmlid="sale.menu_product_template_action">
                            Products
                        </li>
                    </ul>
                </nav>
            `);
            expectSelector(
                `.o_menu_sections .dropdown-item:contains('Products'), nav.o_burger_menu_content li[data-menu-xmlid='sale.menu_product_template_action']`
            ).toMatch(".dropdown-item,li");
        });

        test("invalid selectors", async () => {
            mount(FULL_HTML_TEMPLATE);

            expect(() => queryAll`[colspan=1]`).toThrow();
            expect(() => queryAll`[href=/]`).toThrow();
        });

        test("queryAllContents", async () => {
            mount(FULL_HTML_TEMPLATE);

            expect(queryAllContents(".title")).toEqual(["Title", "List header", "Form title"]);
            expect(queryAllContents("footer")).toEqual(["Footer Back to top"]);
        });

        test("queryOne", async () => {
            mount(FULL_HTML_TEMPLATE);

            expect(queryOne(".title:first")).toBe($$("header .title")[0]);

            expect(() => queryOne(".title")).toThrow();
            expect(() => queryOne(".title", { exact: 2 })).toThrow();
        });

        test.skip("performance against jQuery", async () => {
            const jQuery = globalThis.$;

            const time = (fn) => {
                const start = performance.now();
                fn(selector);
                return Number((performance.now() - start).toFixed(3));
            };

            const selector = `main:first-of-type:not(:has(:contains(This text does not exist))):contains('List header') > form:has([name="name"]):contains("Form title"):nth-child(6).overflow-auto:visible select[name=job] option:selected`;
            const jQueryTimes = [];
            const queryAllTimes = [];

            for (let i = 0; i < 100; i++) {
                getFixture().innerHTML = FULL_HTML_TEMPLATE;

                jQueryTimes.push(time(jQuery));
                queryAllTimes.push(time(queryAll));
            }

            const jQueryAvg = jQueryTimes.reduce((a, b) => a + b, 0) / jQueryTimes.length;
            const queryAllAvg = queryAllTimes.reduce((a, b) => a + b, 0) / queryAllTimes.length;

            expect(queryAllAvg).toBeLessThan(jQueryAvg);
        });
    });
});
