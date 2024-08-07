import { patchWebsocketWorkerWithCleanup } from "@bus/../tests/mock_websocket";
import {
    assertSteps,
    click,
    contains,
    defineMailModels,
    insertText,
    openDiscuss,
    start,
    startServer,
    step,
} from "@mail/../tests/mail_test_helpers";
import { describe, test } from "@odoo/hoot";
import { mockDate } from "@odoo/hoot-mock";
import { getService } from "@web/../tests/web_test_helpers";

describe.current.tags("desktop");
defineMailModels();

test("Member list and Pinned Messages Panel menu are exclusive", async () => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({ name: "General" });
    await start();
    await openDiscuss(channelId);
    await click("[title='Members']");
    await contains(".o-discuss-ChannelMemberList");
    await click("[title='Pinned Messages']");
    await contains(".o-discuss-PinnedMessagesPanel");
    await contains(".o-discuss-ChannelMemberList", { count: 0 });
});

test("bus subscription is refreshed when channel is joined", async () => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create([{ name: "General" }, { name: "Sales" }]);
    patchWebsocketWorkerWithCleanup({
        _sendToServer({ event_name, data }) {
            if (event_name === "subscribe") {
                step(`subscribe - ${JSON.stringify(data.channels)}`);
            }
        },
    });
    const later = luxon.DateTime.now().plus({ seconds: 2 });
    mockDate(
        `${later.year}-${later.month}-${later.day} ${later.hour}:${later.minute}:${later.second}`
    );
    await start();
    const expectedSubscribes = [];
    for (const { type, id } of getService("mail.store").imStatusTrackedPersonas) {
        const model = type === "partner" ? "res.partner" : "mail.guest";
        expectedSubscribes.unshift(`"odoo-presence-${model}_${id}"`);
    }
    await assertSteps([`subscribe - [${expectedSubscribes.join(",")}]`]);
    await openDiscuss();
    await assertSteps([]);
    await click("input[placeholder='Find or start a conversation']");
    await insertText("input[placeholder='Search a conversation']", "new channel");
    await click("a", { text: "Create Channel" });
    await contains(".o-mail-DiscussSidebar-item", { text: "new channel" });
    const [newChannel] = pyEnv["discuss.channel"].search([["name", "=", "new channel"]]);
    expectedSubscribes.unshift(`"discuss.channel_${newChannel}"`);
    await assertSteps([
        `subscribe - [${expectedSubscribes.join(",")}]`,
        `subscribe - [${expectedSubscribes.join(",")}]`, // 1 is enough. The 2 comes from technical details (1: from channel_join, 2: from channel open), 2nd covers shadowing
    ]);
});

test("bus subscription is refreshed when channel is left", async () => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({ name: "General" });
    patchWebsocketWorkerWithCleanup({
        _sendToServer({ event_name, data }) {
            if (event_name === "subscribe") {
                step(`subscribe - ${JSON.stringify(data.channels)}`);
            }
        },
    });
    const later = luxon.DateTime.now().plus({ seconds: 2 });
    mockDate(
        `${later.year}-${later.month}-${later.day} ${later.hour}:${later.minute}:${later.second}`
    );
    const env = await start();
    const imStatusChannels = [];
    for (const { type, id } of env.services["mail.store"].imStatusTrackedPersonas) {
        const model = type === "partner" ? "res.partner" : "mail.guest";
        imStatusChannels.unshift(`"odoo-presence-${model}_${id}"`);
    }
    await assertSteps([`subscribe - [${imStatusChannels.join(",")}]`]);
    await openDiscuss();
    await assertSteps([]);
    await click("[title='Leave Channel']");
    await assertSteps([`subscribe - [${imStatusChannels.join(",")}]`]);
});

test("Guest user cannot post in read only channel", async () => {
    const pyEnv = await startServer();
    const channel_id = pyEnv["discuss.channel"].create({ name: "General", read_only: true });
    await start({ authenticateAs: false });
    await openDiscuss(channel_id);
    await contains(`.o-mail-Composer-input[readonly][placeholder="This channel is read only"]`, {
        count: 1,
    });
});

test("Non admin user cannot post on read only channel", async () => {
    const pyEnv = await startServer();
    const channel_id = pyEnv["discuss.channel"].create({ name: "General", read_only: true });
    const partnerId = pyEnv["res.users"].create({
        name: "test user",
        login: "test",
        password: "test",
        partner_id: pyEnv["res.partner"].create({
            name: "test_partner",
            isAdmin: false,
        }),
    });
    const [partnerUser] = pyEnv["res.users"].search_read([["id", "=", partnerId]]);
    await start({ authenticateAs: partnerUser });
    await openDiscuss(channel_id);
    await contains(`.o-mail-Composer-input[readonly][placeholder="This channel is read only"]`, {
        count: 1,
    });
});
