/** @odoo-module */

import { MessageService } from "@mail/core/message_service";
import { patch } from "@web/core/utils/patch";
import { ChatbotStep } from "@im_livechat/new/chatbot/chatbot_step_model";
import { markup } from "@odoo/owl";

patch(MessageService.prototype, "im_livechat", {
    insert(data) {
        const message = this._super(data);
        if (data.chatbot_script_step_id) {
            message.chatbotStep = new ChatbotStep(data);
            message.body = message.body ?? markup(message.chatbotStep.message);
        }
        return message;
    },
});
