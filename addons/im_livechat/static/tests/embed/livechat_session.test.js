import { LivechatButton } from "@im_livechat/embed/common/livechat_button";
import {
    defineLivechatModels,
    loadDefaultEmbedConfig,
} from "@im_livechat/../tests/livechat_test_helpers";
import { describe, expect, test } from "@odoo/hoot";
import { advanceTime } from "@odoo/hoot-mock";
import {
    click,
    contains,
    insertText,
    onRpcBefore,
    start,
    startServer,
    triggerHotkey,
} from "@mail/../tests/mail_test_helpers";
import { mountWithCleanup } from "@web/../tests/web_test_helpers";

describe.current.tags("desktop");
defineLivechatModels();

test("Session is reset after failing to persist the channel", async () => {
    await startServer();
    await loadDefaultEmbedConfig();
    onRpcBefore("/im_livechat/get_session", (args) => {
        if (args.persisted) {
            return false;
        }
    });
    await start({ authenticateAs: false, env: { zzz: true } });
    await mountWithCleanup(LivechatButton);
    await click(".o-livechat-LivechatButton");
    await insertText(".o-mail-Composer-input", "Hello World!");
    triggerHotkey("Enter");
    await contains(".o_notification", {
        text: "No available collaborator, please try again later.",
    });
    await contains(".o-livechat-LivechatButton");
    await advanceTime(LivechatButton.DEBOUNCE_DELAY + 10);
    await click(".o-livechat-LivechatButton");
    await contains(".o-mail-ChatWindow");
});

test("Fold state is saved on the server", async () => {
    const pyEnv = await startServer();
    await loadDefaultEmbedConfig();
    const env = await start({ authenticateAs: false });
    await mountWithCleanup(LivechatButton);
    await click(".o-livechat-LivechatButton");
    await contains(".o-mail-Thread");
    await insertText(".o-mail-Composer-input", "Hello World!");
    triggerHotkey("Enter");
    await contains(".o-mail-Message", { text: "Hello World!" });
    const guestId = pyEnv.cookie.get("dgid");
    let [member] = pyEnv["discuss.channel.member"].search_read([
        ["guest_id", "=", guestId],
        ["channel_id", "=", env.services["im_livechat.livechat"].thread.id],
    ]);
    expect(member.fold_state).toBe("open");
    await click(".o-mail-ChatWindow-header");
    await contains(".o-mail-Thread", { count: 0 });
    [member] = pyEnv["discuss.channel.member"].search_read([
        ["guest_id", "=", guestId],
        ["channel_id", "=", env.services["im_livechat.livechat"].thread.id],
    ]);
    expect(member.fold_state).toBe("folded");
    await click(".o-mail-ChatWindow-header");
});
