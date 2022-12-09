/** @odoo-module **/

import { makeDeferred } from "@mail/utils/deferred";
import { start, startServer } from "@mail/../tests/helpers/test_utils";

import { getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";

let target;
QUnit.module("follower", {
    async beforeEach() {
        target = getFixture();
    },
});

QUnit.test("base rendering not editable", async function (assert) {
    const pyEnv = await startServer();
    const [threadId, partnerId] = pyEnv["res.partner"].create([{}, {}]);
    pyEnv["mail.followers"].create({
        is_active: true,
        partner_id: partnerId,
        res_id: threadId,
        res_model: "res.partner",
    });
    const { click, openView } = await start({
        async mockRPC(route, args, performRpc) {
            if (route === "/mail/thread/data") {
                // mimic user without write access
                const res = await performRpc(...arguments);
                res["hasWriteAccess"] = false;
                return res;
            }
        },
    });
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-details");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-avatar");
    assert.containsNone(target, ".o-mail-chatter-topbar-follower-list-follower-button");
});

QUnit.test("base rendering editable", async function (assert) {
    const pyEnv = await startServer();
    const [threadId, partnerId] = pyEnv["res.partner"].create([{}, {}]);
    pyEnv["mail.followers"].create({
        is_active: true,
        partner_id: partnerId,
        res_id: threadId,
        res_model: "res.partner",
    });
    const { click, openView } = await start();
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-details");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-avatar");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-edit-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-remove-button");
});

QUnit.test("click on partner follower details", async function (assert) {
    const pyEnv = await startServer();
    const [threadId, partnerId] = pyEnv["res.partner"].create([{}, {}]);
    pyEnv["mail.followers"].create({
        is_active: true,
        partner_id: partnerId,
        res_id: threadId,
        res_model: "res.partner",
    });
    const openFormDef = makeDeferred();
    const { click, env, openView } = await start();
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    patchWithCleanup(env.services.action, {
        doAction(action) {
            assert.step("do_action");
            assert.strictEqual(action.res_id, partnerId);
            assert.strictEqual(action.res_model, "res.partner");
            assert.strictEqual(action.type, "ir.actions.act_window");
            openFormDef.resolve();
        },
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-details");

    document.querySelector(".o-mail-chatter-topbar-follower-list-follower-details").click();
    await openFormDef;
    assert.verifySteps(["do_action"], "clicking on follower should redirect to partner form view");
});

QUnit.test("click on edit follower", async function (assert) {
    const pyEnv = await startServer();
    const [threadId, partnerId] = pyEnv["res.partner"].create([{}, {}]);
    pyEnv["mail.followers"].create({
        is_active: true,
        partner_id: partnerId,
        res_id: threadId,
        res_model: "res.partner",
    });
    const { click, messaging, openView } = await start({
        async mockRPC(route, args) {
            if (route.includes("/mail/read_subscription_data")) {
                assert.step("fetch_subtypes");
            }
        },
    });
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    const thread = messaging.models["Thread"].insert({
        id: threadId,
        model: "res.partner",
    });
    await thread.fetchData(["followers"]);
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-edit-button");

    await click(".o-mail-chatter-topbar-follower-list-follower-edit-button");
    assert.verifySteps(["fetch_subtypes"], "clicking on edit follower should fetch subtypes");
    assert.containsOnce(target, ".o-mail-follower-subtype-dialog");
});

QUnit.test("edit follower and close subtype dialog", async function (assert) {
    const pyEnv = await startServer();
    const [threadId, partnerId] = pyEnv["res.partner"].create([{}, {}]);
    pyEnv["mail.followers"].create({
        is_active: true,
        partner_id: partnerId,
        res_id: threadId,
        res_model: "res.partner",
    });
    const { click, openView } = await start({
        async mockRPC(route, args) {
            if (route.includes("/mail/read_subscription_data")) {
                assert.step("fetch_subtypes");
            }
        },
    });
    await openView({
        res_id: threadId,
        res_model: "res.partner",
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower");
    assert.containsOnce(target, ".o-mail-chatter-topbar-follower-list-follower-edit-button");

    await click(".o-mail-chatter-topbar-follower-list-follower-edit-button");
    assert.verifySteps(["fetch_subtypes"], "clicking on edit follower should fetch subtypes");
    assert.containsOnce(target, ".o-mail-follower-subtype-dialog");

    await click(".o-mail-follower-subtype-dialog-close");
    assert.containsNone(target, ".o-mail-follower-subtype-dialog");
});
