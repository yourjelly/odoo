/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { Command } from "@mail/../tests/helpers/command";
import { start } from "@mail/../tests/helpers/test_utils";
import { click, contains, insertText } from "@web/../tests/utils";

QUnit.module("New message separator");

QUnit.test("Separator disappears when going back to the thread twice", async () => {
    const pyEnv = await startServer();
    const bobPartnerId = pyEnv["res.partner"].create({ name: "Bob" });
    const [chatWithBobId] = pyEnv["discuss.channel"].create([
        {
            channel_type: "chat",
            channel_member_ids: [
                Command.create({ partner_id: bobPartnerId }),
                Command.create({ partner_id: pyEnv.adminPartnerId }),
            ],
        },
        {
            channel_type: "channel",
            name: "General",
        },
    ]);
    pyEnv["mail.message"].create({
        body: "Hello",
        res_id: chatWithBobId,
        model: "discuss.channel",
    });
    const { openDiscuss } = await start();
    openDiscuss(chatWithBobId);
    await click("[title='Expand']");
    await click("[title='Mark as Unread']");
    await contains("button", { text: "Bob", contains: [".badge", { text: "1" }] });
    await contains(".o-mail-Thread-newMessage");
    await click(".o-mail-DiscussSidebarChannel", { text: "General" });
    await contains(".o-mail-AutoresizeInput", { value: "General" });
    await click(".o-mail-DiscussSidebarChannel", { text: "Bob" });
    await contains("button", { text: "Bob", contains: [".badge", { text: "1" }], count: 0 });
    await contains(".o-mail-Thread-newMessage");
    await click(".o-mail-DiscussSidebarChannel", { text: "General" });
    await contains(".o-mail-AutoresizeInput", { value: "General" });
    await click(".o-mail-DiscussSidebarChannel", { text: "Bob" });
    await contains(".o-mail-Thread-newMessage", { count: 0 });
});

QUnit.test("Separator disappears when posting a message", async () => {
    const pyEnv = await startServer();
    const bobPartnerId = pyEnv["res.partner"].create({ name: "Bob" });
    const chatWithBobId = pyEnv["discuss.channel"].create({
        channel_type: "chat",
        channel_member_ids: [
            Command.create({ partner_id: bobPartnerId }),
            Command.create({ partner_id: pyEnv.adminPartnerId }),
        ],
    });
    pyEnv["mail.message"].create({
        body: "Hello",
        res_id: chatWithBobId,
        model: "discuss.channel",
    });
    const { openDiscuss } = await start();
    openDiscuss(chatWithBobId);
    await click("[title='Expand']");
    await click("[title='Mark as Unread']");
    await contains("button", { text: "Bob", contains: [".badge", { text: "1" }] });
    await contains(".o-mail-Thread-newMessage");
    await insertText(".o-mail-Composer-input", "Test");
    await click(".o-mail-Composer-send:enabled");
    await contains(".o-mail-Thread-newMessage", { count: 0 });
    await contains("button", { text: "Bob", contains: [".badge", { text: "1" }], count: 0 });
});

QUnit.test("Separator is shown when receiving message on thread that is not opened", async () => {
    const pyEnv = await startServer();
    const demoPartnerId = pyEnv["res.partner"].create({ name: "Bob" });
    const demoUserId = pyEnv["res.users"].create({ name: "Bob", partner_id: demoPartnerId });
    const [generalChannelId, salesChannelId] = pyEnv["discuss.channel"].create([
        {
            channel_type: "channel",
            name: "General",
        },
        {
            channel_type: "channel",
            name: "Sales",
            channel_member_ids: [
                Command.create({ partner_id: pyEnv.currentPartnerId }),
                Command.create({ partner_id: demoPartnerId }),
            ],
        },
    ]);
    const { env, openDiscuss } = await start();
    openDiscuss(generalChannelId);
    pyEnv.withUser(demoUserId, () =>
        env.services.rpc("/mail/message/post", {
            post_data: { body: "Hello", message_type: "comment" },
            thread_id: salesChannelId,
            thread_model: "discuss.channel",
        })
    );
    await click(".o-mail-DiscussSidebarChannel", { text: "Sales" });
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
});

QUnit.test("Separator is not shown when message is received on current thread", async () => {
    const pyEnv = await startServer();
    const bobPartnerId = pyEnv["res.partner"].create({ name: "Bob" });
    const bobUserId = pyEnv["res.users"].create({ name: "Bob", partner_id: bobPartnerId });
    const generalChannelId = pyEnv["discuss.channel"].create({
        channel_type: "channel",
        name: "General",
    });
    pyEnv["mail.message"].create({
        body: "Hello",
        res_id: generalChannelId,
        model: "discuss.channel",
        author_id: bobPartnerId,
    });
    const { env, openDiscuss } = await start();
    openDiscuss(generalChannelId);
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
    insertText(".o-mail-Composer-input", "Test");
    await click(".o-mail-Composer-send:enabled");
    await contains(".o-mail-Thread-newMessage", { count: 0 });
    pyEnv.withUser(bobUserId, () =>
        env.services.rpc("/mail/message/post", {
            post_data: { body: "Hello", message_type: "comment" },
            thread_id: generalChannelId,
            thread_model: "discuss.channel",
        })
    );
    await contains(".o-mail-Thread-newMessage", { count: 0 });
});
