/** @odoo-module **/

import { start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("thread");

QUnit.test(
    "out of office message on direct chat with out of office partner",
    async function (assert) {
        const pyEnv = await startServer();
        const partnerId = pyEnv["res.partner"].create({
            name: "Demo",
            im_status: "leave_online",
            out_of_office_date_end: "2023-01-01",
        });
        const channelId = pyEnv["mail.channel"].create({
            channel_member_ids: [
                [0, 0, { partner_id: pyEnv.currentPartnerId }],
                [0, 0, { partner_id: partnerId }],
            ],
            channel_type: "chat",
        });
        const { openDiscuss } = await start();
        await openDiscuss(channelId);
        assert.containsOnce(document.body, ".alert:contains(Out of office until Jan 1, 2023)");
    }
);
