/** @odoo-module alias=@mail/../tests/qunit_suite_tests/widgets/emojis_char_field_tests default=false */
const test = QUnit.test; // QUnit.test()

import { click, editInput, nextTick } from "@web/../tests/helpers/utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";
import { openFormView, start } from "@mail/../tests/helpers/test_utils";
import { addFakeModel } from "@bus/../tests/helpers/model_definitions_helpers";
import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    async _performRPC(route, args) {
        if (route === "/load_emoji_bundle") {
            return {"path": "/web/static/src/core/emoji_picker/emoji_data/test.json"};
        }
        return super._performRPC(...arguments);
    },
});

let serverData;

QUnit.module("mail", {}, () => {
    QUnit.module("widgets", {}, (hooks) => {
        addFakeModel("mailing.mailing", {
            subject: { string: "Subject", type: "char", trim: true },
        });

        hooks.beforeEach(() => {
            serverData = {
                views: {
                    "mailing.mailing,false,form": `
                    <form>
                        <field name="subject" widget="char_emojis"/>
                    </form>
                `,
                },
            };
            setupViewRegistries();
        });

        QUnit.module("emojis_char_field_tests.js");

        test("emojis_char_field_tests widget: insert emoji at end of word", async function (assert) {
            assert.expect(2);
            await start({ serverData });
            await openFormView("mailing.mailing");

            const inputName = document.querySelector("input#subject_0");
            await editInput(inputName, null, "Hello");
            assert.strictEqual(inputName.value, "Hello");

            click(document, ".o_field_char_emojis button");
            await nextTick();
            await waitForElement('.o-Emoji[data-codepoints="😀"]');
            click(document, '.o-Emoji[data-codepoints="😀"]');
            assert.strictEqual(inputName.value, "Hello😀");
        });

        test("emojis_char_field_tests widget: insert emoji as new word", async function (assert) {
            assert.expect(2);
            await start({ serverData });
            await openFormView("mailing.mailing");

            const inputName = document.querySelector("input#subject_0");
            await editInput(inputName, null, "Hello ");
            assert.strictEqual(inputName.value, "Hello ");

            click(document, ".o_field_char_emojis button");
            await nextTick();
            await waitForElement('.o-Emoji[data-codepoints="😀"]');
            click(document, '.o-Emoji[data-codepoints="😀"]');
            assert.strictEqual(inputName.value, "Hello 😀");
        });
    });
});

async function waitForElement(selector, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise((resolve) => setTimeout(resolve, 50)); // Check every 50ms
    }
    throw new Error(`No element found (selector: ${selector}) within ${timeout}ms`);
}