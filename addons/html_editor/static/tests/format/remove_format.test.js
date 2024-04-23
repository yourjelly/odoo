import { test } from "@odoo/hoot";
import { testEditor } from "../_helpers/editor";

test('should do nothing if no format is set', async () => {
    await testEditor( {
        contentBefore: '<div>ab[cd]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
});
test('should not remove "non formating" html class', async () => {
    await testEditor( {
        contentBefore: '<div>ab<span class="xyz">[cd]</span>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab<span class="xyz">[cd]</span>ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>a[b<span class="xyz">cd</span>e]f</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a[b<span class="xyz">cd</span>e]f</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<span class="xyz">b[cd]e</span>f</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<span class="xyz">b[cd]e</span>f</div>',
    });
});
test('should remove bold format', async () => {
    await testEditor( {
        contentBefore: '<div>ab<b>[cd]</b>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<b>cd]</b>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<b>[cd</b>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<b>cd</b>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<b>cd</b>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<b>b[cd]e</b>f</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<b>b</b>[cd]<b>e</b>f</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<b>b[c</b>d]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<b>b</b>[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<font style="font-weight: bold">[cd]</font>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<font style="font-weight: 500">[cd]</font>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<font style="font-weight: 600">[cd]</font>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
});
test('should remove italic format', async () => {
    await testEditor( {
        contentBefore: '<div>ab<i>[cd]</i>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<i>cd]</i>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<i>[cd</i>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<i>cd</i>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<i>cd</i>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<i>b[cd]e</i>f</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<i>b</i>[cd]<i>e</i>f</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<i>b[c</i>d]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<i>b</i>[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<font style="font-style: italic">[cd]</font>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
});
test('should remove underline format', async () => {
    await testEditor( {
        contentBefore: '<div>ab<u>[cd]</u>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<u>cd]</u>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<u>[cd</u>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<u>cd</u>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab[<u>cd</u>]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<u>b[cd]e</u>f</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<u>b</u>[cd]<u>e</u>f</div>',
    });
    await testEditor( {
        contentBefore: '<div>a<u>b[c</u>d]ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>a<u>b</u>[cd]ef</div>',
    });
    await testEditor( {
        contentBefore: '<div>ab<font style="text-decoration: underline">[cd]</font>ef</div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div>ab[cd]ef</div>',
    });
});
test("should remove the background image when clear the format", async () => {
    await testEditor({
        contentBefore:
            '<div><p><font class="text-gradient" style="background-image: linear-gradient(135deg, rgb(255, 204, 51) 0%, rgb(226, 51, 255) 100%);">[ab]</font></p></div>',
        stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
        contentAfter: '<div><p><span>[ab]</span></p></div>',
    });
});

test(
    "should remove all the colors for the text separated by Shift+Enter when using removeFormat button",
    async () => {
        await testEditor({
            contentBefore: `<div><h1><font style="color: rgb(255, 0, 0);">[abc</font><br><font style="color: rgb(255, 0, 0);">abc</font><br><font style="color: rgb(255, 0, 0);">abc</font><br><font style="color: rgb(255, 0, 0);">abc]</font></h1></div>`,
            stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
            contentAfter: `<div><h1>[abc<br>abc<br>abc<br>abc]</h1></div>`,
        });
        await testEditor({
            contentBefore: `<div><h1><font style="background-color: rgb(255, 0, 0);">[abc</font><br><font style="background-color: rgb(255, 0, 0);">abc</font><br><font style="background-color: rgb(255, 0, 0);">abc]</font></h1></div>`,
            stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
            contentAfter: `<div><h1>[abc<br>abc<br>abc]</h1></div>`,
        });
    }
);
test(
    "should remove all the colors for the text separated by Enter when using removeFormat button",
    async () => {
        await testEditor({
            contentBefore: `<div><h1><font style="background-color: rgb(255, 0, 0);">[abc</font></h1><h1><font style="background-color: rgb(255, 0, 0);">abc</font></h1><h1><font style="background-color: rgb(255, 0, 0);">abc]</font></h1></div>`,
            stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
            contentAfter: `<div><h1>[abc</h1><h1>abc</h1><h1>abc]</h1></div>`,
        });
        await testEditor({
            contentBefore: `<div><h1><font style="color: rgb(255, 0, 0);">[abc</font></h1><h1><font style="color: rgb(255, 0, 0);">abc</font></h1><h1><font style="color: rgb(255, 0, 0);">abc]</font></h1></div>`,
            stepFunction: (editor) => editor.dispatch("FORMAT_REMOVE_FORMAT"),
            contentAfter: `<div><h1>[abc</h1><h1>abc</h1><h1>abc]</h1></div>`,
        });
    }
);
