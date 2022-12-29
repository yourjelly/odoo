/** @odoo-module **/

import { start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("mail", {}, function () {
    QUnit.module("components", {}, function () {
        QUnit.module("chatter_suggested_recipients_tests.js");

        QUnit.skipRefactoring(
            "suggested recipient without partner are unchecked when closing the dialog without creating partner",
            async function (assert) {
                assert.expect(1);
                const pyEnv = await startServer();
                const resFakeId1 = pyEnv["res.fake"].create({ email_cc: "john@test.be" });
                const { click, openView } = await start();
                await openView({
                    res_id: resFakeId1,
                    res_model: "res.fake",
                    views: [[false, "form"]],
                });
                await click(`.o_ChatterTopbar_buttonSendMessage`);
                // click on checkbox to open dialog
                await document
                    .querySelector(
                        ".o_ComposerSuggestedRecipientView:not([data-partner-id]) input[type=checkbox]"
                    )
                    .click();
                function waitForElm(selector) {
                    return new Promise((resolve) => {
                        if (document.querySelector(selector)) {
                            return resolve(document.querySelector(selector));
                        }

                        const observer = new MutationObserver((mutations) => {
                            if (document.querySelector(selector)) {
                                resolve(document.querySelector(selector));
                                observer.disconnect();
                            }
                        });

                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                        });
                    });
                }

                await waitForElm(".modal-header");
                // close dialog without changing anything
                document.querySelector(".modal-header > button.btn-close").click();

                assert.notOk(
                    document.querySelector(
                        ".o_ComposerSuggestedRecipientView:not([data-partner-id]) input[type=checkbox]"
                    ).checked,
                    "suggested recipient without partner must be unchecked"
                );
            }
        );
    });
});
