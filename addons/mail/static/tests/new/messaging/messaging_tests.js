/** @odoo-module **/

import { Messaging } from "@mail/new/core/messaging_service";
import { afterNextRender, start, startServer } from "@mail/../tests/helpers/test_utils";
import { getFixture, nextTick, patchWithCleanup } from "@web/../tests/helpers/utils";

let target;
QUnit.module("messaging", {
    async beforeEach() {
        target = getFixture();
    },
});

QUnit.test(
    "Posting a message to a partner out of discuss should open a chat window",
    async function (assert) {
        const { env, pyEnv } = await start();
        const partnerId = pyEnv["res.partner"].create({ name: "Dumbledore" });
        const userId = pyEnv["res.users"].create({ partner_id: partnerId });
        const channelId = pyEnv["mail.channel"].create({
            channel_member_ids: [
                [0, 0, { partner_id: pyEnv.currentPartnerId }],
                [0, 0, { partner_id: partnerId }],
            ],
            channel_type: "chat",
        });
        const [channel] = pyEnv["mail.channel"].searchRead([["id", "=", channelId]]);
        await afterNextRender(() =>
            env.services.rpc("/mail/chat_post", {
                context: { mockedUserId: userId },
                message_content: "new message",
                uuid: channel.uuid,
            })
        );
        assert.containsOnce(target, ".o-mail-chat-window-header:contains(Dumbledore)");
    }
);

QUnit.test(
    "Posting a message to a partner should open a chat window after leaving discuss",
    async function (assert) {
        const { env, openDiscuss, openFormView, pyEnv } = await start();
        await openDiscuss();
        const partnerId = pyEnv["res.partner"].create({ name: "Dumbledore" });
        const userId = pyEnv["res.users"].create({ partner_id: partnerId });
        const channelId = pyEnv["mail.channel"].create({
            channel_member_ids: [
                [0, 0, { partner_id: pyEnv.currentPartnerId }],
                [0, 0, { partner_id: partnerId }],
            ],
            channel_type: "chat",
        });
        const [channel] = pyEnv["mail.channel"].searchRead([["id", "=", channelId]]);
        env.services.rpc("/mail/chat_post", {
            context: { mockedUserId: userId },
            message_content: "new message",
            uuid: channel.uuid,
        });
        // leaving discuss.
        await openFormView("res.partner", partnerId);
        assert.containsOnce(target, ".o-mail-chat-window-header:contains(Dumbledore)");
    }
);

QUnit.test(
    "'mail.channel/message' dispatched to every notification handler",
    async function (assert) {
        patchWithCleanup(Messaging.prototype, {
            handleNotification(notifications) {
                this._super(notifications);
                if (notifications.map(({ type }) => type).includes("mail.channel/new_message")) {
                    // mail.channel/new_message notification is received as well
                    // as the other notification that was batched with it.
                    assert.step("notifications - received");
                    assert.strictEqual(notifications.length, 2);
                }
            },
        });
        const pyEnv = await startServer();
        const channelId = pyEnv["mail.channel"].create({ name: "General" });
        const messageId = pyEnv["mail.message"].create({
            body: "hello world",
            model: "mail.channel",
            res_id: channelId,
        });
        const { env } = await start();
        const [message] = await env.services.orm.call("mail.message", "message_format", [
            messageId,
        ]);
        pyEnv["bus.bus"]._sendmany([
            [pyEnv.currentPartnerId, "mail.channel/new_message", { id: channelId, message }],
            [
                pyEnv.currentPartnerId,
                "mail.message/toggle_star",
                { messageIds: [messageId], starred: true },
            ],
        ]);
        await nextTick();
        assert.verifySteps(["notifications - received"]);
    }
);
