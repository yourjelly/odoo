import { presenceService } from "@bus/services/presence_service";
import { rpcWithEnv } from "@mail/utils/common/misc";
import {
    assertSteps,
    click,
    contains,
    defineMailModels,
    insertText,
    onRpcBefore,
    openDiscuss,
    openFormView,
    start,
    startServer,
    step,
    triggerHotkey,
} from "@mail/../tests/mail_test_helpers";
import { describe, test } from "@odoo/hoot";
import { withUser } from "@web/../tests/_framework/mock_server/mock_server";
import { Command, mockService, serverState } from "@web/../tests/web_test_helpers";
import { mockDate } from "@odoo/hoot-mock";

/** @type {ReturnType<import("@mail/utils/common/misc").rpcWithEnv>} */
let rpc;
describe.current.tags("desktop");
defineMailModels();

test("keep until user goes back to the thread", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Foreigner partner" });
    const channelId = pyEnv["discuss.channel"].create({
        name: "test",
        channel_member_ids: [
            Command.create({ partner_id: partnerId }),
            Command.create({ partner_id: serverState.partnerId }),
        ],
    });
    pyEnv["mail.message"].create({
        author_id: partnerId,
        body: "hello",
        message_type: "comment",
        model: "discuss.channel",
        res_id: channelId,
    });
    const env = await start();
    rpc = rpcWithEnv(env);
    await openDiscuss(channelId);
    await contains(".o-mail-Thread");
    await contains(".o-mail-Message", { text: "hello" });
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
    await click(".o-mail-DiscussSidebar-item", { text: "History" });
    await contains(".o-mail-Discuss-threadName", { value: "History" });
    await click(".o-mail-DiscussSidebar-item", { text: "test" });
    await contains(".o-mail-Discuss-threadName", { value: "test" });
    await contains(".o-mail-Thread-newMessage hr + span", { count: 0, text: "New messages" });
});

test("show on receiving new message when out of odoo focus", async () => {
    mockService("presence", () => ({
        ...presenceService.start(),
        isOdooFocused: () => false,
    }));
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Foreigner partner" });
    const userId = pyEnv["res.users"].create({
        name: "Foreigner user",
        partner_id: partnerId,
    });
    const channelId = pyEnv["discuss.channel"].create({
        channel_member_ids: [
            Command.create({ message_unread_counter: 0, partner_id: serverState.partnerId }),
            Command.create({ partner_id: partnerId }),
        ],
        channel_type: "channel",
        name: "General",
    });
    const env = await start();
    rpc = rpcWithEnv(env);
    await openDiscuss(channelId);
    await contains(".o-mail-Thread");
    await contains(".o-mail-Thread-newMessage hr + span", { count: 0, text: "New messages" });
    // simulate receiving a message
    await withUser(userId, () =>
        rpc("/mail/message/post", {
            post_data: { body: "hu", message_type: "comment", subtype_xmlid: "mail.mt_comment" },
            thread_id: channelId,
            thread_model: "discuss.channel",
        })
    );
    await contains(".o-mail-Message", { text: "hu" });
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
    await contains(".o-mail-Thread-newMessage ~ .o-mail-Message", { text: "hu" });
});

test("keep until current user sends a message", async () => {
    const pyEnv = await startServer();
    const bobPartnerId = pyEnv["res.partner"].create({ name: "Bob" });
    const channelId = pyEnv["discuss.channel"].create({
        channel_member_ids: [
            Command.create({ message_unread_counter: 0, partner_id: serverState.partnerId }),
        ],
        channel_type: "channel",
        name: "General",
    });
    pyEnv["mail.message"].create({
        body: "first message",
        message_type: "comment",
        model: "discuss.channel",
        res_id: channelId,
        author_id: bobPartnerId,
    });
    await start();
    await openDiscuss(channelId);
    await contains(".o-mail-Message");
    await contains(".o-mail-Thread-newMessage hr + span", { count: 1, text: "New messages" });
    await insertText(".o-mail-Composer-input", "hey!");
    await click(".o-mail-Composer-send:enabled");
    await contains(".o-mail-Message", { count: 2 });
    await contains(".o-mail-Thread-newMessage hr + span", { count: 0, text: "New messages" });
});

test("keep when switching between chat window and discuss of same thread", async () => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({ channel_type: "channel", name: "General" });
    await start();
    await click(".o_menu_systray i[aria-label='Messages']");
    await click("button", { text: "General" });
    await insertText(".o-mail-Composer-input", "Very important message!");
    await triggerHotkey("Enter");
    await click(".o-mail-Message [title='Expand']");
    await click(".o-mail-Message-moreMenu [title='Mark as Unread']");
    await contains(".o-mail-Thread-newMessage");
    await click("[title='Open Actions Menu']");
    await click("[title='Open in Discuss']");
    await contains(".o-mail-Discuss-threadName", { value: "General" });
    await contains(".o-mail-Thread-newMessage");
    await openFormView("res.partner", serverState.partnerId);
    await contains(".o-mail-ChatWindow-header", { text: "General" });
    await contains(".o-mail-Thread-newMessage");
});

test("show when message is received in chat window", async () => {
    mockDate("2023-01-03 12:00:00"); // so that it's after last interest (mock server is in 2019 by default!)
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Demo" });
    const userId = pyEnv["res.users"].create({ name: "Foreigner user", partner_id: partnerId });
    const channelId = pyEnv["discuss.channel"].create({
        channel_member_ids: [
            Command.create({
                fold_state: "open",
                unpin_dt: "2021-01-01 12:00:00",
                last_interest_dt: "2021-01-01 10:00:00",
                partner_id: serverState.partnerId,
            }),
            Command.create({ partner_id: partnerId }),
        ],
        channel_type: "chat",
    });
    const messageId = pyEnv["mail.message"].create({
        body: "not empty",
        model: "discuss.channel",
        res_id: channelId,
    });
    const [memberId] = pyEnv["discuss.channel.member"].search([
        ["channel_id", "=", channelId],
        ["partner_id", "=", serverState.partnerId],
    ]);
    pyEnv["discuss.channel.member"].write([memberId], { seen_message_id: messageId });
    const env = await start();
    rpc = rpcWithEnv(env);
    // simulate receiving a message
    withUser(userId, () =>
        rpc("/mail/message/post", {
            post_data: { body: "hu", message_type: "comment" },
            thread_id: channelId,
            thread_model: "discuss.channel",
        })
    );
    await contains(".o-mail-ChatWindow");
    await contains(".o-mail-Message", { count: 2 });
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
    await contains(".o-mail-Thread-newMessage + .o-mail-Message", { text: "hu" });
});

test("show when message is received while chat window is closed", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Demo" });
    const userId = pyEnv["res.users"].create({
        name: "Foreigner user",
        partner_id: partnerId,
    });
    const channelId = pyEnv["discuss.channel"].create({
        channel_member_ids: [
            Command.create({ partner_id: serverState.partnerId, fold_state: "open" }),
            Command.create({ partner_id: partnerId }),
        ],
        channel_type: "chat",
    });
    onRpcBefore("/mail/action", (args) => {
        if (args.init_messaging) {
            step(`/mail/action - ${JSON.stringify(args)}`);
        }
    });
    const env = await start();
    rpc = rpcWithEnv(env);
    await assertSteps([
        `/mail/action - ${JSON.stringify({
            init_messaging: {},
            failures: true,
            systray_get_activities: true,
            context: { lang: "en", tz: "taht", uid: serverState.userId, allowed_company_ids: [1] },
        })}`,
    ]);
    await click(".o-mail-ChatWindow-command[title='Close Chat Window']");
    await contains(".o-mail-ChatWindow", { count: 0 });
    // send after init_messaging because bus subscription is done after init_messaging
    // simulate receiving a message
    await withUser(userId, () =>
        rpc("/mail/message/post", {
            post_data: { body: "hu", message_type: "comment" },
            thread_id: channelId,
            thread_model: "discuss.channel",
        })
    );
    await contains(".o-mail-ChatWindow");
    await contains(".o-mail-Thread-newMessage hr + span", { text: "New messages" });
});
