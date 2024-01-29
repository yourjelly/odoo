/** @odoo-module */

import { test } from "@odoo/hoot";
import { testEditor } from "../../test_helpers/editor";
import { em, span } from "../../test_helpers/tags";
import { italic } from "../../test_helpers/user_actions";

test("should make a few characters italic", async () => {
    await testEditor({
        contentBefore: `<p>ab[cde]fg</p>`,
        stepFunction: italic,
        contentAfter: `<p>ab${em(`[cde]`)}fg</p>`,
    });
});

test("should make a few characters not italic", async () => {
    await testEditor({
        contentBefore: `<p>${em(`ab[cde]fg`)}</p>`,
        stepFunction: italic,
        contentAfter: `<p>${em(`ab`)}[cde]${em(`fg`)}</p>`,
    });
});

test("should make two paragraphs italic", async () => {
    await testEditor({
        contentBefore: "<p>[abc</p><p>def]</p>",
        stepFunction: italic,
        contentAfter: `<p>${em(`[abc`)}</p><p>${em(`def]`)}</p>`,
    });
});

test("should make two paragraphs not italic", async () => {
    await testEditor({
        contentBefore: `<p>${em(`[abc`)}</p><p>${em(`def]`)}</p>`,
        stepFunction: italic,
        contentAfter: `<p>[abc</p><p>def]</p>`,
    });
});

test("should make qweb tag italic", async () => {
    await testEditor({
        contentBefore: `<div><p t-esc="'Test'" contenteditable="false">[Test]</p></div>`,
        stepFunction: italic,
        contentAfter: `<div><p t-esc="'Test'" contenteditable="false" style="font-style: italic;">[Test]</p></div>`,
    });
});

test("should make a whole heading italic after a triple click", async () => {
    await testEditor({
        contentBefore: `<h1>[ab</h1><p>]cd</p>`,
        stepFunction: italic,
        contentAfter: `<h1>${em(`[ab]`)}</h1><p>cd</p>`,
    });
});

test("should make a whole heading not italic after a triple click", async () => {
    await testEditor({
        contentBefore: `<h1>${em(`[ab`)}</h1><p>]cd</p>`,
        stepFunction: italic,
        contentAfter: `<h1>[ab]</h1><p>cd</p>`,
    });
});

test("should make a selection starting with italic text fully italic", async () => {
    await testEditor({
        contentBefore: `<p>${em(`[ab`)}</p><p>c]d</p>`,
        stepFunction: italic,
        contentAfter: `<p>${em(`[ab`)}</p><p>${em(`c]`)}d</p>`,
    });
});

test.todo("should make a selection with italic text in the middle fully italic", async () => {
    await testEditor({
        contentBefore: `<p>[a${em(`b`)}</p><p>${em(`c`)}d]e</p>`,
        stepFunction: italic,
        contentAfter: `<p>${em(`[ab`)}</p><p>${em(`cd]`)}e</p>`,
    });
});

test.todo("should make a selection ending with italic text fully italic", async () => {
    await testEditor({
        contentBefore: `<p>[ab</p><p>${em(`c]d`)}</p>`,
        stepFunction: italic,
        contentAfter: `<p>${em(`[ab`)}</p><p>${em(`c]d`)}</p>`,
    });
});

test.todo("should get ready to type in italic", async () => {
    await testEditor({
        contentBefore: `<p>ab[]cd</p>`,
        stepFunction: italic,
        contentAfterEdit: `<p>ab${em(`[]\u200B`, "first")}cd</p>`,
        contentAfter: `<p>ab[]cd</p>`,
    });
});

test.todo("should get ready to type in not italic", async () => {
    await testEditor({
        contentBefore: `<p>${em(`ab[]cd`)}</p>`,
        stepFunction: italic,
        contentAfterEdit: `<p>${em(`ab`)}${span(`[]\u200B`, "first")}${em(`cd`)}</p>`,
        contentAfter: `<p>${em(`ab[]cd`)}</p>`,
    });
});

test("should not format non-editable text (italic)", async () => {
    await testEditor({
        contentBefore: '<p>[a</p><p contenteditable="false">b</p><p>c]</p>',
        stepFunction: italic,
        contentAfter: `<p>${em("[a")}</p><p contenteditable="false">b</p><p>${em("c]")}</p>`,
    });
});
