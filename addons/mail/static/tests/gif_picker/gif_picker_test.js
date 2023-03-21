/* @odoo-module */

import {
    click,
    insertText,
    start,
    startServer,
    waitUntil,
} from "@mail/../tests/helpers/test_utils";

QUnit.module("gif");

QUnit.test("composer should display an emoji button", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    assert.containsOnce($, "button[aria-label='Gifs']");
});

QUnit.test("Composer gif button should open the gif picker", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    assert.containsOnce($, ".o-mail-gif-picker");
});

QUnit.test("Searching for a gif", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    await insertText("input[placeholder='Search for a gif']", "search");
    assert.containsOnce($, ".o-mail-gif-picker .fa-arrow-left");
    await waitUntil(".o-mail-gif", 2);
});

QUnit.test("Click on a gif category", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    await click("img[data-src='https://media.tenor.com/6uIlQAHIkNoAAAAM/cry.gif']");
    assert.containsOnce($, ".o-mail-gif-picker .fa-arrow-left");
    await waitUntil(".o-mail-gif", 2);
    assert.strictEqual(
        document.querySelector("input[placeholder='Search for a gif']").value,
        "cry"
    );
});

QUnit.test("Reopen gif category", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    await click("img[data-src='https://media.tenor.com/6uIlQAHIkNoAAAAM/cry.gif']");
    await click(".o-mail-gif-picker .fa-arrow-left");
    assert.containsOnce($, ".o-mail-gif-categories");
});

QUnit.test("Make a gif favorite", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    await click("img[data-src='https://media.tenor.com/6uIlQAHIkNoAAAAM/cry.gif']");
    const firstGif = document.querySelector(".o-mail-gif .fa-star-o");
    await click(firstGif);
    assert.containsOnce($, ".o-mail-gif .fa-star");
    await click(".o-mail-gif-picker .fa-arrow-left");
    await click(".o-mail-gif-category:contains(Favorites)");
    assert.containsOnce($, ".o-mail-gif");
});

QUnit.test("Remove a gif favorite", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({ name: "" });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click("button[aria-label='Gifs']");
    await click("img[data-src='https://media.tenor.com/6uIlQAHIkNoAAAAM/cry.gif']");
    const firstGif = document.querySelector(".o-mail-gif .fa-star-o");
    await click(firstGif);
    await click(".o-mail-gif-picker .fa-arrow-left");
    await click(".o-mail-gif-category:contains(Favorites)");
    await click(".o-mail-gif .fa-star");
    assert.containsNone($, ".o-mail-gif");
});

QUnit.test("Chatter should not have the gif button", async (assert) => {
    const { openFormView, pyEnv } = await start();
    const partnerId = pyEnv["res.partner"].create({ name: "John Doe" });
    await openFormView("res.partner", partnerId);
    await click("button:contains(Log note)");
    assert.containsNone($, "button[aria-label='Gifs']");
});
