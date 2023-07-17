/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { Command } from "@mail/../tests/helpers/command";
import { click, start } from "@mail/../tests/helpers/test_utils";

QUnit.module("Channel invite");

QUnit.test("Can invite a partner to a livechat channel", async (assert) => {
    const pyEnv = await startServer();
    const userId = pyEnv["res.users"].create({ name: "James" });
    pyEnv["res.partner"].create({
        name: "James",
        user_ids: [userId],
    });
    const channelId = pyEnv["discuss.channel"].create({
        anonymous_name: "Visitor 20",
        name: "Visitor 20",
        channel_member_ids: [
            Command.create({ partner_id: pyEnv.currentPartnerId }),
            Command.create({ partner_id: pyEnv.publicPartnerId }),
        ],
        channel_type: "livechat",
        livechat_operator_id: pyEnv.currentPartnerId,
    });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[title='Add Users']");
    await click(".o-discuss-ChannelInvitation-selectable:contains(James) input");
    await click("button:contains(Invite)");
    await click("button[title='Show Member List']");
    assert.containsOnce($, ".o-discuss-ChannelMember:contains(James)");
});

QUnit.test("Available operators come first", async (assert) => {
    const pyEnv = await startServer();
    pyEnv["res.partner"].create({
        name: "Harry",
        im_status: "offline",
        user_ids: [pyEnv["res.users"].create({ name: "Harry" })],
    });
    const availableOperatorId = pyEnv["res.partner"].create({
        name: "Available operator",
        im_status: "online",
        user_ids: [pyEnv["res.users"].create({ name: "Available operator" })],
    });
    pyEnv["im_livechat.channel"].create({
        available_operator_ids: [Command.create({ partner_id: availableOperatorId })],
    });
    const channelId = pyEnv["discuss.channel"].create({
        anonymous_name: "Visitor #1",
        channel_member_ids: [
            Command.create({ partner_id: pyEnv.currentPartnerId }),
            Command.create({ partner_id: pyEnv.publicPartnerId }),
        ],
        channel_type: "livechat",
    });

    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[title='Add Users']");
    const partnerSuggestions = document.querySelectorAll(".o-discuss-ChannelInvitation-selectable");
    assert.ok(partnerSuggestions[0].textContent.includes("Available operator"));
    assert.ok(partnerSuggestions[1].textContent.includes("Harry"));
});

QUnit.test("Order on invitation count when none are available", async (assert) => {
    const pyEnv = await startServer();
    pyEnv["res.partner"].create({
        name: "Less invited partner",
        im_status: "offline",
        user_ids: [pyEnv["res.users"].create({ name: "Less invited partner" })],
    });
    const mostInvitedPartnerId = pyEnv["res.partner"].create({
        name: "Most invited partner",
        im_status: "offline",
        user_ids: [pyEnv["res.users"].create({ name: "Most invited partner" })],
    });
    pyEnv["discuss.channel"].create({
        anonymous_name: "Visitor #1",
        channel_member_ids: [
            Command.create({ partner_id: mostInvitedPartnerId, create_uid: pyEnv.currentUserId }),
        ],
    });
    const channelId = pyEnv["discuss.channel"].create({
        anonymous_name: "Visitor #1",
        channel_member_ids: [
            Command.create({ partner_id: pyEnv.currentPartnerId }),
            Command.create({ partner_id: pyEnv.publicPartnerId }),
        ],
        channel_type: "livechat",
    });

    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[title='Add Users']");
    const partnerSuggestions = document.querySelectorAll(".o-discuss-ChannelInvitation-selectable");
    assert.ok(partnerSuggestions[0].textContent.includes("Most invited partner"));
    assert.ok(partnerSuggestions[1].textContent.includes("Less invited partner"));
});
