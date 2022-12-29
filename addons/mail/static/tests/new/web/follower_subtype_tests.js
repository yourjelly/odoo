/** @odoo-module **/

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";
import { getFixture } from "@web/../tests/helpers/utils";
import { makeFakeNotificationService } from "@web/../tests/helpers/mock_services";

let target;
QUnit.module("follower subtype", {
    async beforeEach() {
        target = getFixture();
    },
});

QUnit.test("simplest layout of a followed subtype", async function (assert) {
    const pyEnv = await startServer();
    const subtypeId = pyEnv["mail.message.subtype"].create({
        default: true,
        name: "TestSubtype",
    });
    const followerId = pyEnv["mail.followers"].create({
        display_name: "François Perusse",
        partner_id: pyEnv.currentPartnerId,
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        subtype_ids: [subtypeId],
    });
    pyEnv["res.partner"].write([pyEnv.currentPartnerId], { message_follower_ids: [followerId] });
    const { openView } = await start({
        // FIXME: should adapt mock server code to provide "hasWriteAccess"
        async mockRPC(route, args, performRPC) {
            if (route === "/mail/thread/data") {
                // mimic user with write access
                const res = await performRPC(...arguments);
                res["hasWriteAccess"] = true;
                return res;
            }
        },
    });
    await openView({
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    await click("button[title='Edit subscription']");
    assert.containsOnce(target, ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype)");
    assert.containsOnce(
        document.querySelector(".o-mail-follower-subtype-dialog-subtype"),
        ".o-mail-follower-subtype-dialog-subtype-label"
    );
    assert.containsOnce(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype)"),
        "input[type='checkbox']"
    );
    assert.strictEqual(
        $(
            ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) .o-mail-follower-subtype-dialog-subtype-label"
        )[0].textContent,
        "TestSubtype"
    );
    assert.ok(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']")[0]
            .checked
    );
});

QUnit.test("simplest layout of a not followed subtype", async function (assert) {
    const pyEnv = await startServer();
    pyEnv["mail.message.subtype"].create({
        default: true,
        name: "TestSubtype",
    });
    const followerId = pyEnv["mail.followers"].create({
        display_name: "François Perusse",
        partner_id: pyEnv.currentPartnerId,
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
    });
    pyEnv["res.partner"].write([pyEnv.currentPartnerId], { message_follower_ids: [followerId] });
    const { openView } = await start({
        // FIXME: should adapt mock server code to provide "hasWriteAccess"
        async mockRPC(route, args, performRPC) {
            if (route === "/mail/thread/data") {
                // mimic user with write access
                const res = await performRPC(...arguments);
                res["hasWriteAccess"] = true;
                return res;
            }
        },
    });
    await openView({
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    await click("button[title='Edit subscription']");
    assert.notOk(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']")[0]
            .checked,
        "checkbox should not be checked as follower subtype is not followed"
    );
});

QUnit.test("toggle follower subtype checkbox", async function (assert) {
    const pyEnv = await startServer();
    pyEnv["mail.message.subtype"].create({
        default: true,
        name: "TestSubtype",
    });
    const followerId = pyEnv["mail.followers"].create({
        display_name: "François Perusse",
        partner_id: pyEnv.currentPartnerId,
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
    });
    pyEnv["res.partner"].write([pyEnv.currentPartnerId], { message_follower_ids: [followerId] });
    const { openView } = await start({
        // FIXME: should adapt mock server code to provide "hasWriteAccess"
        async mockRPC(route, args, performRPC) {
            if (route === "/mail/thread/data") {
                // mimic user with write access
                const res = await performRPC(...arguments);
                res["hasWriteAccess"] = true;
                return res;
            }
        },
    });
    await openView({
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    await click("button[title='Edit subscription']");
    assert.notOk(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']")[0]
            .checked,
        "checkbox should not be checked as follower subtype is not followed"
    );

    await click(
        ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']"
    );
    assert.ok(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']")[0]
            .checked
    );

    await click(
        ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']"
    );
    assert.notOk(
        $(".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype) input[type='checkbox']")[0]
            .checked
    );
});

QUnit.test("follower subtype apply", async function (assert) {
    const pyEnv = await startServer();
    const subtypeId = pyEnv["mail.message.subtype"].create({
        default: true,
        name: "TestSubtype1",
    });
    pyEnv["mail.message.subtype"].create({
        default: true,
        name: "TestSubtype2",
    });
    const followerId = pyEnv["mail.followers"].create({
        display_name: "François Perusse",
        partner_id: pyEnv.currentPartnerId,
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        subtype_ids: [subtypeId],
    });
    pyEnv["res.partner"].write([pyEnv.currentPartnerId], { message_follower_ids: [followerId] });
    const { openView } = await start({
        services: {
            notification: makeFakeNotificationService((message) => {
                assert.strictEqual(
                    message,
                    "The subscription preferences were successfully applied."
                );
            }),
        },
    });
    await openView({
        res_model: "res.partner",
        res_id: pyEnv.currentPartnerId,
        views: [[false, "form"]],
    });
    await click(".o-mail-chatter-topbar-follower-list-button");
    await click("button[title='Edit subscription']");

    const subtype1 =
        ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype1) input[type='checkbox']";
    const subtype2 =
        ".o-mail-follower-subtype-dialog-subtype:contains(TestSubtype2) input[type='checkbox']";
    assert.ok($(subtype1)[0].checked);
    assert.notOk($(subtype2)[0].checked);
    await click(subtype1);
    assert.notOk($(subtype1)[0].checked);
    await click(subtype2);
    assert.ok($(subtype2)[0].checked);
    await click(".modal-footer button:contains(Apply)");
});
