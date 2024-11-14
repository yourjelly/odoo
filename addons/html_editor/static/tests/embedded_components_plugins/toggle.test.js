import { test, describe, beforeEach } from "@odoo/hoot";
import { testEditor } from "../_helpers/editor";
import { unformat } from "../_helpers/format";
import { deleteBackward } from "../_helpers/user_actions";
import { patchWithCleanup } from "@web/../tests/web_test_helpers";
import { EmbeddedToggleComponent } from "@html_editor/others/embedded_components/core/toggle/toggle";
import { onMounted } from "@odoo/owl";
import { Deferred } from "@odoo/hoot-mock";
import { browser } from "@web/core/browser/browser";

let embeddedToggleMountedPromise;

beforeEach(() => {
    embeddedToggleMountedPromise = new Deferred();
    patchWithCleanup(EmbeddedToggleComponent.prototype, {
        setup() {
            super.setup();
            onMounted(() => {
                embeddedToggleMountedPromise.resolve();
            });
        },
    });
});

describe("deleteBackward applied to toggle", () => {
    test("toggle open: should be inside the content", async () => {
        browser.localStorage.setItem(`Toggle1.showContent`, "true");
        await testEditor({
            contentBefore: unformat(
                `<p><br/></p>
                <div data-embedded="toggle"
                    data-oe-protected="true" contenteditable="false" data-embedded-props="" class="mb-2">
                    <div data-embedded-editable="title">
                        <p>Hello World<br/></p>
                    </div>
                    <div data-embedded-editable="content">
                        <p><br/></p>
                    </div>
                </div>
                <p>[]<br/></p>`
            ),
            stepFunction: async (editor) => {
                await embeddedToggleMountedPromise;
                deleteBackward(editor);
            },
            contentAfter: unformat(`
                <p><br/></p>
                <div data-embedded="toggle"
                    data-oe-protected="true" contenteditable="false" data-embedded-props="" class="mb-2">
                    <div class="d-flex flex-row align-items-center">
                        <button class="btn d-flex align-items-center o_embedded_toggle_button">
                            <i class="fa fa-fw align-self-center fa-caret-down"/>
                        </button>
                        <div class="flex-fill">
                            <div data-embedded-editable="title">
                                <p>Hello World<br/></p>
                            </div>
                        </div>
                    </div>
                    <div class="ps-4">
                        <div data-embedded-editable="content">
                            <p>[]<br/></p>
                        </div>
                    </div>
                </div>
            `),
        });
    });
    test("toggle closed: should be inside the title", async () => {
        const uid = 1;
        browser.localStorage.setItem(`Toggle${uid}.showContent`, "false");
        await testEditor({
            contentBefore: unformat(
                `<p><br/></p>
                <div data-embedded="toggle"
                    data-oe-protected="true" contenteditable="false" data-embedded-props="" class="mb-2">
                    <div data-embedded-editable="title">
                        <p>Hello World<br/></p>
                    </div>
                    <div data-embedded-editable="content">
                        <p><br/></p>
                    </div>
                </div>
                <p>[]<br/></p>`
            ),
            stepFunction: async (editor) => {
                await embeddedToggleMountedPromise;
                deleteBackward(editor);
            },
            contentAfter: "<p>[]<br></p>",
        });
        await testEditor({
            contentBefore: '<ol><li class="oe-nested"><ol><li>[]abc</li></ol></li></ol>',
            stepFunction: deleteBackward,
            contentAfter: "<p>[]abc</p>",
        });
    });
});
