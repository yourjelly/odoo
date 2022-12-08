/** @odoo-module **/

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";
import { Thread } from "@mail/new/core/thread_model";

import { nextTick } from "@web/../tests/helpers/utils";

QUnit.module("mail", () => {
    QUnit.module("models");

    QUnit.test("Thread model can be partially updated", async (assert) => {
        const pyEnv = await startServer();
        const threadId = pyEnv["mail.channel"].create({ name: "General", description: "FooBar" });
        const { env } = await start();
        let thread = env.services["mail.messaging"].state.threads[threadId];
        assert.ok(
            thread.name === "General" && thread.description === "FooBar",
            "Initial thread values should be the one from the server"
        );
        Thread.insert(env.services["mail.messaging"].state, {
            id: threadId,
            description: "BarFoo",
        });
        await nextTick();
        thread = env.services["mail.messaging"].state.threads[threadId];
        assert.ok(
            thread.name === "General" && thread.description === "BarFoo",
            "Thread is updated from partial thread insert but non present keys are kept as is"
        );
    });
});
