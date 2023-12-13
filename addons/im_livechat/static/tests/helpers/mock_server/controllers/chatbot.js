/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /**
     * @override
     */
    async _performRPC(route, args) {
        if (route === "/chatbot/post_welcome_steps") {
            return this._mockRouteChatbotPostWelcomeSteps(
                args.channel_uuid,
                args.chatbot_script_id
            );
        }
        if (route === "/chatbot/step/validate_email") {
            const [channel] = this.pyEnv["discuss.channel"].searchRead([
                ["uuid", "=", args.channel_uuid],
            ]);
            const messages = this.pyEnv["mail.message"].searchRead([
                ["res_id", "=", channel.id],
                ["model", "=", "discuss.channel"],
            ]);
            const [rule] = this.pyEnv["im_livechat.channel.rule"].searchRead([
                ["channel_id", "=", channel.id],
            ]);
            return this._mockChatbotScript__validateEmail(
                rule.chatbot_script_id[0],
                messages.at(-1).body,
                channel
            );
        }
        return super._performRPC(...arguments);
    },

    /**
     * Simulates the `/chatbot/post_welcome_steps` route.
     */
    _mockRouteChatbotPostWelcomeSteps(channel_uuid, chatbot_script_id) {
        const [channel] = this.pyEnv["discuss.channel"].searchRead([["uuid", "=", channel_uuid]]);
        return this._mockChatbotScript__postWelcomeSteps(chatbot_script_id, channel);
    },
});
