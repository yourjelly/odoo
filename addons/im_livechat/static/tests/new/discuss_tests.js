/** @odoo-module */

import { afterNextRender, click, start, startServer } from "@mail/../tests/helpers/test_utils";
import { getFixture } from "@web/../tests/helpers/utils";

let target;
QUnit.module("discuss", {
    beforeEach() {
        target = getFixture();
    },
});

QUnit.test("No call buttons", async function (assert) {
    const pyEnv = await startServer();
    pyEnv["mail.channel"].create({
        anonymous_name: "Visitor 11",
        channel_member_ids: [
            [0, 0, { partner_id: pyEnv.currentPartnerId }],
            [0, 0, { partner_id: pyEnv.publicPartnerId }],
        ],
        channel_type: "livechat",
        livechat_operator_id: pyEnv.currentPartnerId,
    });
    const { openDiscuss } = await start();
    await openDiscuss();
    assert.containsNone(target, ".o-mail-discuss-actions button i.fa-phone");
    assert.containsNone(target, ".o-mail-discuss-actions button i.fa-gear");
});

QUnit.test("No reaction button", async function (assert) {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({
        anonymous_name: "Visitor 11",
        channel_type: "livechat",
        livechat_operator_id: pyEnv.currentPartnerId,
        channel_partner_ids: [pyEnv.currentPartnerId, pyEnv.publicPartnerId],
    });
    pyEnv["mail.message"].create({
        body: "not empty",
        model: "mail.channel",
        res_id: channelId,
    });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click(".o-mail-message");
    assert.containsNone(document.body, "i[aria-label='Add a Reaction']");
});

QUnit.test("No reply button", async function (assert) {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({
        anonymous_name: "Visitor 11",
        channel_type: "livechat",
        livechat_operator_id: pyEnv.currentPartnerId,
        channel_partner_ids: [pyEnv.currentPartnerId, pyEnv.publicPartnerId],
    });
    pyEnv["mail.message"].create({
        body: "not empty",
        model: "mail.channel",
        res_id: channelId,
    });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click(".o-mail-message");
    assert.containsNone(document.body, "i[aria-label='Reply']");
});

QUnit.debug(
    "add livechat in the sidebar on visitor sending first message",
    async function (assert) {
        const pyEnv = await startServer();
        pyEnv["res.users"].write([pyEnv.currentUserId], { im_status: "online" });
        const resCountryId1 = pyEnv["res.country"].create({
            code: "be",
            name: "Belgium",
        });
        const imLivechatChannelId1 = pyEnv["im_livechat.channel"].create({
            user_ids: [pyEnv.currentUserId],
        });
        const mailChannelId1 = pyEnv["mail.channel"].create({
            anonymous_name: "Visitor (Belgium)",
            channel_member_ids: [
                [
                    0,
                    0,
                    {
                        is_pinned: false,
                        partner_id: pyEnv.currentPartnerId,
                    },
                ],
                [0, 0, { partner_id: pyEnv.publicPartnerId }],
            ],
            channel_type: "livechat",
            country_id: resCountryId1,
            livechat_channel_id: imLivechatChannelId1,
            livechat_operator_id: pyEnv.currentPartnerId,
        });
        const { env, openDiscuss } = await start();
        await openDiscuss();
        assert.containsNone(
            target,
            ".o-mail-category-livechat",
            "should not have any livechat in the sidebar initially"
        );

        // simulate livechat visitor sending a message
        const channel = pyEnv["mail.channel"].searchRead([["id", "=", mailChannelId1]])[0];
        await afterNextRender(async () =>
            env.services.rpc("/mail/chat_post", {
                context: {
                    mockedUserId: false,
                },
                uuid: channel.uuid,
                message_content: "new message",
            })
        );
        // assert.containsOnce(
        //     document.body,
        //     ".o_DiscussSidebarView_categoryLivechat",
        //     "should have a channel group livechat in the side bar after receiving first message"
        // );
        // assert.containsOnce(
        //     document.body,
        //     ".o_DiscussSidebarView_categoryLivechat .o-mail-category-item",
        //     "should have a livechat in the sidebar after receiving first message"
        // );
        // assert.strictEqual(
        //     document.querySelector(
        //         ".o_DiscussSidebarView_categoryLivechat .o-mail-category-item .o_DiscussSidebarCategoryItem_name"
        //     ).textContent,
        //     "Visitor (Belgium)",
        //     "should have visitor name and country as livechat name"
        // );
    }
);
