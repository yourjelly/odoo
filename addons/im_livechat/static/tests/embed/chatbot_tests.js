/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";
import { loadDefaultConfig, start } from "@im_livechat/../tests/embed/helper/test_utils";
import { Command } from "@mail/../tests/helpers/command";
import { resetRegistries } from "@mail/../tests/helpers/test_utils";
import { destroy } from "@web/../tests/helpers/utils";
import { click, contains, insertText } from "@web/../tests/utils";

QUnit.module("chatbot");

QUnit.debug("test", async () => {
    const pyEnv = await startServer();
    const livechatChannelId = pyEnv["im_livechat.channel"].create({ name: "Livechat Channel" });
    const chatbotScriptId = pyEnv["chatbot.script"].create({
        title: "Customer Service Bot",
        script_step_ids: [
            Command.create({ step_type: "text", message: "Hello, I'm a bot!" }),
            Command.create({ step_type: "text", message: "How can I help you?" }),
            Command.create({ step_type: "question_email", message: "Can you give me your email?" }),
            Command.create({ step_type: "text", message: "Thank you!" }),
        ],
        operator_partner_id: pyEnv["res.partner"].create({
            name: "Welcome Bot",
            user_ids: [Command.create({ name: "Welcome Bot" })],
        }),
    });
    pyEnv["im_livechat.channel.rule"].create({
        channel_id: livechatChannelId,
        chatbot_script_id: chatbotScriptId,
    });
    await loadDefaultConfig(livechatChannelId);
    const webclient = await start();
    await click(".o-livechat-LivechatButton");
    await contains("[data-src*='chatbot_is_typing.gif']");
    await insertText(".o-mail-Composer-input", "Can you give me your email?");
    destroy(webclient);
    resetRegistries();
    await start();
    await contains("[data-src*='chatbot_is_typing.gif']", { count: 0 });
});
