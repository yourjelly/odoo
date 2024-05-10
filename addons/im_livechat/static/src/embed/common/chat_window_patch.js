import { FeedbackPanel } from "@im_livechat/embed/common/feedback_panel/feedback_panel";

import { ChatWindow } from "@mail/core/common/chat_window";

import { useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";

Object.assign(ChatWindow.components, { FeedbackPanel });

patch(ChatWindow.prototype, {
    setup() {
        super.setup(...arguments);
        this.livechatService = useService("im_livechat.livechat");
        this.chatbotService = useState(useService("im_livechat.chatbot"));
    },

    async close() {
        if (this.thread?.eq(this.livechatService.thread)) {
            this.livechatService.leave({ openFeedbackPanel: true });
        }
        if (
            this.thread?.channel_type !== "livechat" ||
            this.thread?.state === "feedback" ||
            this.thread?.isTransient
        ) {
            return super.close();
        }
        this.chatbotService.stop();
    },
});
