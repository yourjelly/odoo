import { describe, expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import { setContent, getContent } from "../_helpers/selection";
import { setupEditor } from "../_helpers/editor";
import { waitUntil, waitFor, click, queryOne, press } from "@odoo/hoot-dom";

describe("should open a popover", () => {
    test("should open a popover when the selection is inside a link and close outside of a link", async () => {
        const { el } = await setupEditor("<p>this is a <a>link</a></p>");
        expect(".o-we-linkpopover").toHaveCount(0);
        // selection inside a link
        setContent(el, "<p>this is a <a>li[]nk</a></p>");
        await waitFor(".o-we-linkpopover");
        expect(".o-we-linkpopover").toHaveCount(1);
        // selection outside a link
        setContent(el, "<p>this []is a <a>link</a></p>");
        await waitUntil(() => !document.querySelector(".o-we-linkpopover"));
        expect(".o-we-linkpopover").toHaveCount(0);
    });
    test("link popover should have input field for href when the link doesn't have href", async () => {
        await setupEditor("<p>this is a <a>li[]nk</a></p>");
        await waitFor(".o-we-linkpopover");
        expect(".o-we-linkpopover").toHaveCount(1);
        expect(".o_we_label_link").toHaveValue("link");
        expect(".o_we_href_input_link").toHaveValue("");
    });
    test("link popover should have buttons for link operation when the link has href", async () => {
        await setupEditor('<p>this is a <a href="test.com">li[]nk</a></p>');
        await waitFor(".o-we-linkpopover");
        expect(".o-we-linkpopover").toHaveCount(1);
        expect(".o_we_copy_link").toHaveCount(1);
        expect(".o_we_edit_link").toHaveCount(1);
        expect(".o_we_remove_link").toHaveCount(1);
    });
    test("link popover should not repositioned when clicking in the input field", async () => {
        await setupEditor("<p>this is a <a>li[]nk</a></p>");
        await waitFor(".o_we_href_input_link");
        const style = queryOne(".o-we-linkpopover").parentElement.style.cssText;
        queryOne(".o_we_href_input_link").focus();
        await animationFrame();
        expect(queryOne(".o-we-linkpopover").parentElement).toHaveAttribute("style", style);
    });
});

describe("popover should switch UI depending on editing state", () => {
    test("after clicking on edit button, the popover should switch to editing mode", async () => {
        await setupEditor('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
        await waitFor(".o-we-linkpopover");
        click(".o_we_edit_link");
        await waitFor(".o_we_href_input_link");
        expect(".o_we_label_link").toHaveValue("link");
        expect(".o_we_href_input_link").toHaveValue("http://test.com/");
    });
    test("after clicking on apply button, the selection should be restored", async () => {
        const { el } = await setupEditor('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
        await waitFor(".o-we-linkpopover");
        click(".o_we_edit_link");
        await waitFor(".o_we_href_input_link");
        click(".o_we_href_input_link");
        click(".o_we_apply_link");
        await waitFor(".o_we_edit_link");
        expect(getContent(el)).toBe('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
    });
    test("after clicking on apply button, the popover should be with the non editing mode, e.g. with three buttons", async () => {
        await setupEditor("<p>this is a <a>li[]nk</a></p>");
        await waitFor(".o-we-linkpopover");
        click(".o_we_href_input_link");
        click(".o_we_apply_link");
        await waitFor(".o_we_edit_link");
        expect(".o-we-linkpopover").toHaveCount(1);
        expect(".o_we_copy_link").toHaveCount(1);
        expect(".o_we_edit_link").toHaveCount(1);
        expect(".o_we_remove_link").toHaveCount(1);
    });
});

describe("popover should edit/remove the link", () => {
    test("after apply url on a link without href, the link element should be updated", async () => {
        const { el } = await setupEditor("<p>this is a <a>li[]nk</a></p>");
        await waitFor(".o_we_href_input_link");
        queryOne(".o_we_href_input_link").focus();
        // mimic the link input behavior
        for (const char of "http://test.com/") {
            press(char);
        }
        await waitFor(".o_we_apply_link");
        click(".o_we_apply_link");
        expect(getContent(el)).toBe('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
    });
    test("after clicking on remove button, the link element should be unwrapped", async () => {
        const { el } = await setupEditor('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
        await waitFor(".o-we-linkpopover");
        click(".o_we_remove_link");
        await waitUntil(() => !document.querySelector(".o-we-linkpopover"));
        expect(getContent(el)).toBe("<p>this is a link[]</p>");
    });
    test("after edit the label, the text of the link should be updated", async () => {
        const { el } = await setupEditor('<p>this is a <a href="http://test.com/">li[]nk</a></p>');
        await waitFor(".o-we-linkpopover");
        click(".o_we_edit_link");
        await waitFor(".o_we_apply_link");
        queryOne(".o_we_label_link").focus();
        // mimic the link input behavior
        for (const char of "new") {
            press(char);
        }
        click(".o_we_apply_link");
        expect(getContent(el)).toBe('<p>this is a <a href="http://test.com/">linknew[]</a></p>');
    });
});
