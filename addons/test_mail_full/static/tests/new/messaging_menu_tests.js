/** @odoo-module **/

import { start, startServer } from "@mail/../tests/helpers/test_utils";
import { getFixture, triggerEvent } from "@web/../tests/helpers/utils";

let target;

QUnit.module("messaging menu", {
    async beforeEach() {
        target = getFixture();
    },
});

QUnit.test("rating value displayed on the preview", async function (assert) {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    const channelId = pyEnv["mail.channel"].create({});
    const messageId = pyEnv["mail.message"].create([
        { author_id: partnerId, model: "mail.channel", res_id: channelId },
    ]);
    pyEnv["rating.rating"].create({
        consumed: true,
        message_id: messageId,
        partner_id: partnerId,
        rating_image_url: "/rating/static/src/img/rating_5.png",
        rating_text: "top",
    });
    await start();
    await triggerEvent(target, ".o_menu_systray i[aria-label='Messages']", "click");
    assert.containsOnce(target, ".o-mail-notification-item-inlineText:contains(Rating:)");
    assert.containsOnce(target, ".o-rating-preview-image[data-alt='top']");
    assert.containsOnce(
        target,
        ".o-rating-preview-image[data-src='/rating/static/src/img/rating_5.png']"
    );
});

QUnit.test("rating value displayed on the needaction preview", async function (assert) {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    const ratingId = pyEnv["mail.test.rating"].create({ name: "Test rating" });
    const messageId = pyEnv["mail.message"].create({
        model: "mail.test.rating",
        needaction: true,
        needaction_partner_ids: [pyEnv.currentPartnerId],
        res_id: ratingId,
    });
    pyEnv["mail.notification"].create({
        mail_message_id: messageId,
        notification_status: "sent",
        notification_type: "inbox",
        res_partner_id: pyEnv.currentPartnerId,
    });
    pyEnv["rating.rating"].create([
        {
            consumed: true,
            message_id: messageId,
            partner_id: partnerId,
            rating_image_url: "/rating/static/src/img/rating_5.png",
            rating_text: "top",
        },
    ]);
    await start();
    await triggerEvent(target, ".o_menu_systray i[aria-label='Messages']", "click");
    assert.containsOnce(target, ".o-mail-notification-item-inlineText:contains(Rating:)");
    assert.containsOnce(target, ".o-rating-preview-image[data-alt='top']");
    assert.containsOnce(
        target,
        ".o-rating-preview-image[data-src='/rating/static/src/img/rating_5.png']"
    );
});
