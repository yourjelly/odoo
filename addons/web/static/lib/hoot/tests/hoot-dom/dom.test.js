/** @odoo-module */

import { describe, expect, getFixture, test } from "@odoo/hoot";
import { tick } from "@odoo/hoot-mock";
import {
    getFocusableElements,
    getNextFocusableElement,
    getParentFrame,
    getPreviousFocusableElement,
    getRect,
    isDisplayed,
    isEditable,
    isEventTarget,
    isFocusable,
    isVisible,
    queryAll,
    queryAllTexts,
    queryOne,
    waitFor,
    waitForNone,
    waitUntil,
} from "@web/../lib/hoot-dom/helpers/dom";
import { click } from "@web/../lib/hoot-dom/helpers/events";
import { mount, parseUrl } from "../local_helpers";

/**
 * @param {...string} queryAllSelectors
 */
const expectSelector = (...queryAllSelectors) => {
    /**
     * @param {string} nativeSelector
     */
    const toEqualNodes = (nativeSelector, options) => {
        if (typeof nativeSelector !== "string") {
            throw new Error(`Invalid selector: ${nativeSelector}`);
        }
        let root = options?.root || getFixture();
        if (typeof root === "string") {
            root = getFixture().querySelector(root);
            if (root.tagName === "IFRAME") {
                root = root.contentDocument;
            }
        }
        let nodes = nativeSelector ? [...root.querySelectorAll(nativeSelector)] : [];
        if (Number.isInteger(options?.index)) {
            nodes = [nodes.at(options.index)];
        }

        const selector = queryAllSelectors.join(", ");
        const fnNodes = queryAll(selector);
        expect(fnNodes).toEqual(queryAll`${selector}`, {
            message: `queryAll should return the same result from a tagged template literal`,
        });
        expect(fnNodes).toEqual(nodes, {
            message: `"${selector}" should match ${nodes.length} nodes`,
        });
    };

    return { toEqualNodes };
};

/**
 * @param {Document} document
 * @param {HTMLElement} [root]
 * @returns {Promise<HTMLIFrameElement>}
 */
const makeIframe = (document, root) => {
    return new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.addEventListener("load", () => resolve(iframe));
        iframe.srcdoc = "<body></body>";
        (root || document.body).appendChild(iframe);
    });
};

/**
 * @param {Partial<DOMRect>} dimensions
 * @param {string} [className]
 */
const makeSquare = (dimensions, className) => {
    const style = Object.entries({ width: 30, height: 30, ...dimensions })
        .map(([k, v]) => `${k}:${v}px`)
        .join(";");
    return /* html */ `
        <div
            class="position-absolute ${className}"
            style="${style}"
        ></div>
    `;
};

const waitForIframes = () =>
    Promise.all(
        [...getFixture().querySelectorAll("iframe")].map(
            (iframe) => new Promise((resolve) => iframe.addEventListener("load", resolve))
        )
    );

const FULL_HTML_TEMPLATE = /* html */ `
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
        <svg></svg>
        <form class="overflow-auto" style="max-width: 100px">
            <h5 class="title">Form title</h5>
            <input name="name" type="text" value="John Doe (JOD)">
            <input name="email" type="email" value="johndoe@sample.com">
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

describe.tags("ui")(parseUrl(import.meta.url), () => {
    test("getFocusableElements", () => {
        mount(/* html */ `
            <input class="input">
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

    test("getNextFocusableElement", () => {
        mount(/* html */ `
            <input class="input">
            <div class="div" tabindex="0">aaa</div>
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        expect(getNextFocusableElement()).toHaveClass("div");
    });

    test("getParentFrame", async () => {
        mount(/* html */ `
            <div class="root"></div>
        `);

        const parent = await makeIframe(document, queryOne(".root"));
        const child = await makeIframe(parent.contentDocument);

        const content = child.contentDocument.createElement("div");
        child.contentDocument.body.appendChild(content);

        expect(getParentFrame(content)).toBe(child);
        expect(getParentFrame(child)).toBe(parent);
        expect(getParentFrame(parent)).toBe(null);
    });

    test("getPreviousFocusableElement", () => {
        mount(/* html */ `
            <input class="input">
            <div class="div" tabindex="0">aaa</div>
            <button class="disabled-button" disabled="disabled">Disabled button</button>
            <button class="button" tabindex="1">Button</button>
        `);

        click(".input");

        expect(getPreviousFocusableElement()).toHaveClass("button");
    });

    test("getRect", () => {
        mount(/* html */ `
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

    test("isEditable", () => {
        expect(isEditable(document.createElement("input"))).toBe(true);
        expect(isEditable(document.createElement("textarea"))).toBe(true);
        expect(isEditable(document.createElement("select"))).toBe(false);

        const editableDiv = document.createElement("div");
        expect(isEditable(editableDiv)).toBe(false);
        editableDiv.setAttribute("contenteditable", "true");
        expect(isEditable(editableDiv)).toBe(true);
    });

    test("isEventTarget", () => {
        expect(isEventTarget(window)).toBe(true);
        expect(isEventTarget(document)).toBe(true);
        expect(isEventTarget(document.body)).toBe(true);
        expect(isEventTarget(document.createElement("form"))).toBe(true);
        expect(isEventTarget(document.createElementNS(SVG_URL, "svg"))).toBe(true);
        expect(isEventTarget({})).toBe(false);
    });

    test("isFocusable", () => {
        mount(FULL_HTML_TEMPLATE);

        expect(isFocusable("input:first")).toBe(true);
        expect(isFocusable("li:first")).toBe(false);
    });

    test("isDisplayed", () => {
        mount(FULL_HTML_TEMPLATE);

        expect(isDisplayed(document)).toBe(true);
        expect(isDisplayed(document.body)).toBe(true);
        expect(isDisplayed(document.head)).toBe(true);
        expect(isDisplayed(document.documentElement)).toBe(true);
        expect(isDisplayed("form")).toBe(true);

        expect(isDisplayed(".d-none")).toBe(false);
        expect(isDisplayed("body")).toBe(false); // not available from fixture
    });

    test("isVisible", () => {
        mount(FULL_HTML_TEMPLATE);

        expect(isVisible(document)).toBe(true);
        expect(isVisible(document.body)).toBe(true);
        expect(isVisible(document.head)).toBe(false);
        expect(isVisible(document.documentElement)).toBe(true);
        expect(isVisible("form")).toBe(true);

        expect(isVisible(".d-none")).toBe(false);
        expect(isVisible("body")).toBe(false); // not available from fixture
    });

    test("waitFor: already in fixture", async () => {
        mount(FULL_HTML_TEMPLATE);

        waitFor(".title").then((el) => {
            expect.step(el.className);
            return el;
        });

        expect([]).toVerifySteps();

        await tick();

        expect(["title"]).toVerifySteps();
    });

    test("waitFor: rejects", async () => {
        await expect(waitFor("never", { timeout: 1 })).rejects.toThrow();
    });

    test("waitFor: add new element", async () => {
        const el1 = document.createElement("div");
        el1.className = "new-element";

        const el2 = document.createElement("div");
        el2.className = "new-element";

        const promise = waitFor(".new-element").then((el) => {
            expect.step(el.className);
            return el;
        });

        await tick();

        expect([]).toVerifySteps();

        getFixture().append(el1, el2);

        await expect(promise).resolves.toBe(el1);

        expect(["new-element"]).toVerifySteps();
    });

    test("waitForNone: DOM empty", async () => {
        waitForNone(".title").then(() => expect.step("none"));
        expect([]).toVerifySteps();

        await tick();

        expect(["none"]).toVerifySteps();
    });

    test("waitForNone: rejects", async () => {
        mount(FULL_HTML_TEMPLATE);

        await expect(waitForNone(".title", { timeout: 1 })).rejects.toThrow();
    });

    test("waitForNone; delete elements", async () => {
        mount(FULL_HTML_TEMPLATE);

        waitForNone(".title").then(() => expect.step("none"));
        expect(".title").toHaveCount(3);

        for (const title of queryAll(".title")) {
            expect([]).toVerifySteps();

            title.remove();

            await tick();
        }

        expect(["none"]).toVerifySteps();
    });

    test("waitUntil: already true", async () => {
        await expect(waitUntil(() => true)).resolves.toBe(true);
    });

    test("waitUntil: rejects", async () => {
        await expect(waitUntil(() => false, { timeout: 1 })).rejects.toThrow();
    });

    test("waitUntil: observe fixture", async () => {
        let value = "";
        waitUntil(() => value).then((v) => expect.step(v));

        expect([]).toVerifySteps();

        value = "test";

        expect([]).toVerifySteps();

        getFixture().setAttribute("data-value", "test"); // trigger mutation observer
        await tick();

        expect(["test"]).toVerifySteps();
    });

    describe("queryAll", () => {
        test("native selectors", () => {
            mount(FULL_HTML_TEMPLATE);

            for (const selector of [
                "main",
                `.${"title"}`,
                `${"ul"}${" "}${`${"li"}`}`,
                ".title",
                "ul > li",
                "form:has(.title:not(.haha)):not(.huhu) input[name='email']:enabled",
                "[colspan='1']",
            ]) {
                expectSelector(selector).toEqualNodes(selector);
            }
        });

        test("custom pseudo-classes", async () => {
            mount(FULL_HTML_TEMPLATE);

            await waitForIframes();

            // :first, :last & :eq
            expectSelector(".title:first").toEqualNodes(".title", { index: 0 });
            expectSelector(".title:last").toEqualNodes(".title", { index: -1 });
            expectSelector(".title:eq(1)").toEqualNodes(".title", { index: 1 });
            expectSelector(".title:eq('1')").toEqualNodes(".title", { index: 1 });
            expectSelector('.title:eq("1")').toEqualNodes(".title", { index: 1 });

            // :contains (text)
            expectSelector("main > .text:contains(ipsum)").toEqualNodes("p");
            expectSelector(".text:contains(/\\bL\\w+\\b\\sipsum/)").toEqualNodes("p");
            expectSelector(".text:contains(item)").toEqualNodes("li");

            // :contains (value)
            expectSelector("input:value(john)").toEqualNodes("[name=name],[name=email]");
            expectSelector("input:value(john doe)").toEqualNodes("[name=name]");
            expectSelector("input:value('John Doe (JOD)')").toEqualNodes("[name=name]");
            expectSelector(`input:value("(JOD)")`).toEqualNodes("[name=name]");
            expectSelector("input:value(johndoe)").toEqualNodes("[name=email]");
            expectSelector("select:value(mr)").toEqualNodes("[name=title]");
            expectSelector("select:value(unknown value)").toEqualNodes("");

            // :selected
            expectSelector("option:selected").toEqualNodes(
                "select[name=title] option[value=mr],select[name=job] option:first-child"
            );

            // :iframe
            expectSelector("iframe p:contains(iframe text content)").toEqualNodes("");
            expectSelector(":iframe p:contains(iframe text content)").toEqualNodes("p", {
                root: "iframe",
            });
        });

        test("advanced use cases", () => {
            mount(FULL_HTML_TEMPLATE);

            // Comma-separated selectors
            expectSelector("p:contains(ipsum),:has(form:contains('Form title'))").toEqualNodes(
                "p,main"
            );

            // :has & :not combinations with custom pseudo-classes
            expectSelector(`select:has(:contains(Employer))`).toEqualNodes("select[name=job]");
            expectSelector(`select:not(:has(:contains(Employer)))`).toEqualNodes(
                "select[name=title]"
            );
            expectSelector(
                `main:first-of-type:not(:has(:contains(This text does not exist))):contains('List header') > form:has([name="name"]):contains("Form title"):nth-child(6).overflow-auto:visible select[name=job] option:selected`
            ).toEqualNodes("select[name=job] option:first-child");

            // :contains & commas
            expectSelector(`p:contains(velit,)`).toEqualNodes("p");
            expectSelector(`p:contains('velit,')`).toEqualNodes("p");
            expectSelector(`p:contains(", tristique")`).toEqualNodes("p");
            expectSelector(`p:contains(/\\bvelit,/)`).toEqualNodes("p");
        });

        // Whatever, at this point I'm just copying failing selectors and creating
        // fake contexts accordingly as I'm fixing them.

        test("comma-separated long selector: no match", () => {
            mount(/* html */ `
                <div class="o_we_customize_panel">
                    <we-customizeblock-option class="snippet-option-ImageTools">
                        <div class="o_we_so_color_palette o_we_widget_opened">
                            idk
                        </div>
                        <we-select data-name="shape_img_opt">
                            <we-toggler></we-toggler>
                        </we-select>
                    </we-customizeblock-option>
                </div>
            `);
            expectSelector(
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] [title='we-select[data-name="shape_img_opt"] we-toggler']`
            ).toEqualNodes("");
        });

        test("comma-separated long selector: match first", () => {
            mount(/* html */ `
                <div class="o_we_customize_panel">
                    <we-customizeblock-option class="snippet-option-ImageTools">
                        <we-select data-name="shape_img_opt">
                            <we-toggler></we-toggler>
                        </we-select>
                    </we-customizeblock-option>
                </div>
            `);
            expectSelector(
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] [title='we-select[data-name="shape_img_opt"] we-toggler']`
            ).toEqualNodes("we-toggler");
        });

        test("comma-separated long selector: match second", () => {
            mount(/* html */ `
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
            ).toEqualNodes("div[title]");
        });

        test("comma-separated :contains", () => {
            mount(/* html */ `
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
            ).toEqualNodes(".dropdown-item,li");
        });

        test(":contains with line return", () => {
            mount(/* html */ `
                <span>
                    <div>Matrix (PAV11, PAV22, PAV31)</div>
                    <div>PA4: PAV41</div>
                </span>
            `);
            expectSelector(
                `span:contains("Matrix (PAV11, PAV22, PAV31)\nPA4: PAV41")`
            ).toEqualNodes("span");
        });

        test(":has(...):first", () => {
            mount(/* html */ `
                <a href="/web/event/1"></a>
                <a target="" href="/web/event/2">
                    <span>Conference for Architects TEST</span>
                </a>
            `);

            expectSelector(
                `a[href*="/event"]:contains("Conference for Architects TEST")`
            ).toEqualNodes("[target]");
            expectSelector(
                `a[href*="/event"]:contains("Conference for Architects TEST"):first`
            ).toEqualNodes("[target]");
        });

        test(":eq", () => {
            mount(/* html */ `
                <ul>
                    <li>a</li>
                    <li>b</li>
                    <li>c</li>
                </ul>
            `);

            expectSelector(`li:first:contains(a)`).toEqualNodes("li:nth-child(1)");
            expectSelector(`li:contains(a):first`).toEqualNodes("li:nth-child(1)");
            expectSelector(`li:first:contains(b)`).toEqualNodes("");
            expectSelector(`li:contains(b):first`).toEqualNodes("li:nth-child(2)");
        });

        test(":empty", () => {
            mount(/* html */ `
                <input class="empty">
                <input class="value" value="value">
            `);

            expectSelector(`input:empty`).toEqualNodes(".empty");
            expectSelector(`input:not(:empty)`).toEqualNodes(".value");
        });

        test("regular :contains", () => {
            mount(/* html */ `
                <div class="website_links_click_chart">
                    <div class="title">
                        0 clicks
                    </div>
                    <div class="title">
                        1 clicks
                    </div>
                    <div class="title">
                        2 clicks
                    </div>
                </div>
            `);

            expectSelector(`.website_links_click_chart .title:contains("1 clicks")`).toEqualNodes(
                ".title:nth-child(2)"
            );
        });

        test("other regular :contains", () => {
            mount(/* html */ `
                <ul
                    class="o-autocomplete--dropdown-menu ui-widget show dropdown-menu ui-autocomplete"
                    style="position: fixed; top: 283.75px; left: 168.938px"
                >
                    <li class="o-autocomplete--dropdown-item ui-menu-item d-block">
                        <a
                            href="#"
                            class="dropdown-item ui-menu-item-wrapper text-truncate ui-state-active"
                            >Account Tax Group Partner</a
                        >
                    </li>
                    <li
                        class="o-autocomplete--dropdown-item ui-menu-item d-block o_m2o_dropdown_option o_m2o_dropdown_option_search_more"
                    >
                        <a href="#" class="dropdown-item ui-menu-item-wrapper text-truncate"
                            >Search More...</a
                        >
                    </li>
                    <li
                        class="o-autocomplete--dropdown-item ui-menu-item d-block o_m2o_dropdown_option o_m2o_dropdown_option_create_edit"
                    >
                        <a href="#" class="dropdown-item ui-menu-item-wrapper text-truncate"
                            >Create and edit...</a
                        >
                    </li>
                </ul>
            `);

            expectSelector(`.ui-menu-item a:contains("Account Tax Group Partner")`).toEqualNodes(
                "ul li:first-child a"
            );
        });

        test(":iframe", async () => {
            mount(/* html */ `
                <iframe srcdoc="&lt;p&gt;Iframe text content&lt;/p&gt;"></iframe>
            `);

            await waitForIframes();

            expectSelector(`:iframe html`).toEqualNodes("html", { root: "iframe" });
            expectSelector(`:iframe body`).toEqualNodes("body", { root: "iframe" });
            expectSelector(`:iframe head`).toEqualNodes("head", { root: "iframe" });
        });

        test(":contains with brackets", () => {
            mount(/* html */ `
                <div class="o_content">
                    <div class="o_field_widget" name="messages">
                        <table class="o_list_view table table-sm table-hover table-striped o_list_view_ungrouped">
                            <tbody>
                                <tr class="o_data_row">
                                    <td class="o_list_record_selector">
                                        bbb
                                    </td>
                                    <td class="o_data_cell o_required_modifier">
                                        <span>
                                            [test_trigger] Mitchell Admin
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `);

            expectSelector(
                `.o_content:has(.o_field_widget[name=messages]):has(td:contains(/^bbb$/)):has(td:contains(/^\\[test_trigger\\] Mitchell Admin$/))`
            ).toEqualNodes(".o_content");
        });

        test(":eq in the middle of a selector", () => {
            mount(/* html */ `
                <ul>
                    <li class="oe_overlay o_draggable"></li>
                    <li class="oe_overlay o_draggable"></li>
                    <li class="oe_overlay o_draggable oe_active"></li>
                    <li class="oe_overlay o_draggable"></li>
                </ul>
            `);
            expectSelector(`.oe_overlay.o_draggable:eq(2).oe_active`).toEqualNodes(
                "li:nth-child(3)"
            );
        });

        test("combinator +", () => {
            mount(/* html */ `
                <form class="js_attributes">
                    <input type="checkbox">
                    <label>Steel - Test</label>
                </form>
            `);

            expectSelector(
                `form.js_attributes input:not(:checked) + label:contains(Steel - Test)`
            ).toEqualNodes("label");
        });

        test("multiple + combinators", () => {
            mount(/* html */ `
                <div class="s_cover">
                    <span class="o_text_highlight">
                        <span class="o_text_highlight_item">
                            <span class="o_text_highlight_path_underline"></span>
                        </span>
                        <br>
                        <span class="o_text_highlight_item">
                            <span class="o_text_highlight_path_underline"></span>
                        </span>
                    </span>
                </div>
            `);
            expectSelector(`
                .s_cover span.o_text_highlight:has(
                    .o_text_highlight_item
                    + br
                    + .o_text_highlight_item
                )
            `).toEqualNodes(".o_text_highlight");
        });

        test(":last", () => {
            mount(/* html */ `
                <div class="o_field_widget" name="messages">
                    <table class="o_list_view table table-sm table-hover table-striped o_list_view_ungrouped">
                        <tbody>
                            <tr class="o_data_row">
                                <td class="o_list_record_remove">
                                    <button class="btn">Remove</button>
                                </td>
                            </tr>
                            <tr class="o_data_row">
                                <td class="o_list_record_remove">
                                    <button class="btn">Remove</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `);
            expectSelector(
                `.o_field_widget[name=messages] .o_data_row td.o_list_record_remove button:visible:last`
            ).toEqualNodes(".o_data_row:last-child button");
        });

        test("select :contains & :value", () => {
            mount(/* html */ `
                <select class="configurator_select form-select form-select-lg">
                    <option value="217" selected="">Metal</option>
                    <option value="218">Wood</option>
                </select>
            `);
            expectSelector(`.configurator_select:has(option:contains(Metal))`).toEqualNodes(
                "select"
            );
            expectSelector(`.configurator_select:has(option:value(217))`).toEqualNodes("select");
            expectSelector(`.configurator_select:has(option:value(218))`).toEqualNodes("select");
            expectSelector(`.configurator_select:value(217)`).toEqualNodes("select");
            expectSelector(`.configurator_select:value(218)`).toEqualNodes("");
            expectSelector(`.configurator_select:value(Metal)`).toEqualNodes("");
        });

        test("invalid selectors", () => {
            mount(FULL_HTML_TEMPLATE);

            expect(() => queryAll`[colspan=1]`).toThrow(); // missing quotes
            expect(() => queryAll`[href=/]`).toThrow(); // missing quotes
            expect(
                () =>
                    queryAll`#o_wblog_posts_loop:has(span:has(i.fa-calendar-o):has(a[href="/blog?search=a"])):has(span:has(i.fa-search):has(a[href^="/blog?date_begin"]))`
            ).toThrow(); // nested :has statements
        });

        test("queryAllTexts", () => {
            mount(FULL_HTML_TEMPLATE);

            expect(queryAllTexts(".title")).toEqual(["Title", "List header", "Form title"]);
            expect(queryAllTexts("footer")).toEqual(["Footer Back to top"]);
        });

        test("queryOne", () => {
            mount(FULL_HTML_TEMPLATE);

            expect(queryOne(".title:first")).toBe(getFixture().querySelector("header .title"));

            expect(() => queryOne(".title")).toThrow();
            expect(() => queryOne(".title", { exact: 2 })).toThrow();
        });

        test.tags("manual")("performance against jQuery", () => {
            const jQuery = globalThis.$;

            const time = (fn) => {
                const start = performance.now();
                fn();
                return Number((performance.now() - start).toFixed(3));
            };

            const testCases = [
                [
                    FULL_HTML_TEMPLATE,
                    `main:first-of-type:not(:has(:contains(This text does not exist))):contains('List header') > form:has([name="name"]):contains("Form title"):nth-child(6).overflow-auto:visible select[name=job] option:selected`,
                ],
                [
                    /* html */ `
                        <div class="o_we_customize_panel">
                            <we-customizeblock-option class="snippet-option-ImageTools">
                                <we-select data-name="shape_img_opt">
                                    <we-toggler></we-toggler>
                                </we-select>
                            </we-customizeblock-option>
                        </div>
                    `,
                    `.o_we_customize_panel:not(:has(.o_we_so_color_palette.o_we_widget_opened)) we-customizeblock-option[class='snippet-option-ImageTools'] we-select[data-name="shape_img_opt"] we-toggler`,
                ],
            ];

            for (const [template, selector] of testCases) {
                const jQueryTimes = [];
                const queryAllTimes = [];

                for (let i = 0; i < 100; i++) {
                    mount(template);

                    jQueryTimes.push(time(() => jQuery(selector)));
                    queryAllTimes.push(time(() => queryAll(selector)));
                }

                const jQueryAvg = jQueryTimes.reduce((a, b) => a + b, 0) / jQueryTimes.length;
                const queryAllAvg = queryAllTimes.reduce((a, b) => a + b, 0) / queryAllTimes.length;

                expect(queryAllAvg).toBeLessThan(jQueryAvg * 1.25); // 25% margin
            }
        });
    });
});
