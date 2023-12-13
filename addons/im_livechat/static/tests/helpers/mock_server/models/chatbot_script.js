/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";
import { isValidEmail } from "@im_livechat/embed/common/misc";

patch(MockServer.prototype, {
    /*
     * Simulates the `_format_for_frontend` method of the `chatbot.script`
     * model.
     */
    _mockChatbotScript__formatForFrontend(id) {
        const [self] = this.pyEnv["chatbot.script"].searchRead([["id", "=", id]]);
        return {
            scriptId: self.id,
            name: self.title,
            partnerId: self.operator_partner_id[0],
            welcomeSteps: this._mockChatbotScript__getWelcomeSteps(id).map((stepId) =>
                this._mockChatbotScriptStep__formatForFrontend(stepId)
            ),
        };
    },

    /**
     * Simulates the `_get_welcome_steps` method of the `chatbot.script` model.
     */
    _mockChatbotScript__getWelcomeSteps(id) {
        const [self] = this.pyEnv["chatbot.script"].searchRead([["id", "=", id]]);
        const welcomteSteps = [];
        const scriptSteps = this.pyEnv["chatbot.script.step"].searchRead([
            ["id", "in", self.script_step_ids],
        ]);
        for (const step of scriptSteps) {
            welcomteSteps.push(step.id);
            if (step.step_type !== "text") {
                break;
            }
        }
        return welcomteSteps;
    },

    /*
     * Simulates the `_post_welcome_steps` method of the `chatbot.script` model.
     */
    async _mockChatbotScript__postWelcomeSteps(id, channel) {
        const [self] = this.pyEnv["chatbot.script"].searchRead([["id", "=", id]]);
        const steps = this.pyEnv["chatbot.script.step"].searchRead([
            ["id", "in", this._mockChatbotScript__getWelcomeSteps(id)],
        ]);
        const [chatbotUserId] = this.pyEnv["res.users"].search([
            ["partner_id", "=", self.operator_partner_id[0]],
        ]);
        const postedMessages = [];
        for (const step of steps) {
            postedMessages.push(
                await this.pyEnv.withUser(chatbotUserId, () =>
                    this._mockMailThreadMessagePost("discuss.channel", [channel.id], {
                        body: step.message,
                        message_type: "comment",
                        subtype_xmlid: "mail.mt_comment",
                    })
                )
            );
        }
        return postedMessages;
    },

    /*
     * Simulates the `_validate_email` method of the `chatbot.script` model.
     */
    async _mockChatbotScript__validateEmail(id, email, channel) {
        const [self] = this.pyEnv["chatbot.script"].searchRead([["id", "=", id]]);
        const result = {};
        if (!isValidEmail(email)) {
            result["success"] = false;
            result[
                "error_message"
            ] = `${email} does not look like a valid email. Can you please try again?`;
            const [chatbotUserId] = this.pyEnv["res.users"].search([
                ["partner_id", "=", self.operator_partner_id[0]],
            ]);
            result["posted_message"] = await this.pyEnv.withUser(chatbotUserId, () =>
                this._mockMailThreadMessagePost("discuss.channel", [channel.id], {
                    body: result["error_message"],
                    message_type: "comment",
                    subtype_xmlid: "mail.mt_comment",
                })
            );
        }
        return result;
    },
});
