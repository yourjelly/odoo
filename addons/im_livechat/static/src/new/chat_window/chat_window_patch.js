/** @odoo-module */

import { ChatWindow } from "@mail/web/chat_window/chat_window";
import { FeedbackPanel } from "../feedback_panel/feedback_panel";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { SESSION_STATE } from "../core/livechat_service";
import { useState } from "@odoo/owl";

ChatWindow.components["FeedbackPanel"] = FeedbackPanel;

patch(ChatWindow.prototype, "im_livechat", {
    setup() {
        this._super(...arguments);
        this.livechatService = useService("im_livechat.livechat");
        this.chatbotService = useState(useService("im_livechat.chatbot"));
    },

    close() {
        if (this.thread?.type !== "livechat") {
            return this._super();
        }
        if (this.livechatService.state === SESSION_STATE.PERSISTED) {
            this.state.activeMode = "feedback";
            this.chatWindowService.show(this.props.chatWindow);
        } else {
            this._super();
        }
        this.chatbotService.stop();
        this.livechatService.leaveSession();
    },

    /**
     * @param {number} rating
     * @param {string} feedback
     */
    sendFeedback(rating, feedback) {
        this.livechatService.sendFeedback(this.thread.uuid, rating, feedback);
    },

    get style() {
        return `${this._super()} transition: height 0.3s linear 0s;`;
    },
});
