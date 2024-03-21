import { SESSION_STATE } from "@im_livechat/embed/common/livechat_service";
import { FeedbackPanel } from "@im_livechat/embed/common/feedback_panel/feedback_panel";

import { ChatWindow } from "@mail/core/common/chat_window";

import { useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";
import { feature } from "@mail/core/common/features";
import { FEATURES } from "./features";

feature(FEATURES.EMBED_LIVECHAT)
    .registerIIFE(() => Object.assign(ChatWindow.components, { FeedbackPanel }))
    .registerPatch(ChatWindow.prototype, {
        setup() {
            super.setup(...arguments);
            this.livechatService = useService("im_livechat.livechat");
            this.chatbotService = useState(useService("im_livechat.chatbot"));
            this.livechatState = useState({
                hasFeedbackPanel: false,
            });
        },

        async close() {
            if (this.thread?.type !== "livechat") {
                return super.close();
            }
            if (this.livechatService.state === SESSION_STATE.PERSISTED) {
                this.livechatState.hasFeedbackPanel = true;
                this.chatWindowService.show(this.props.chatWindow, { notifyState: false });
            } else {
                this.thread?.delete();
                await super.close();
            }
            this.livechatService.leave();
            this.chatbotService.stop();
        },
    })
    .registerTemplateExtension(
        "mail.ChatWindow",
        `
            <t t-inherit="mail.ChatWindow" t-inherit-mode="extension">
                <xpath expr="//*[@name='thread content']" position="replace">
                <FeedbackPanel t-if="livechatState.hasFeedbackPanel" onClickClose="() => this.close()" thread="thread"/>
                <t t-else="">$0</t>
                </xpath>
                <xpath expr="//*[@t-ref='needactionCounter']" position="replace">
                    <t t-if="!chatbotService.chatbot">$0</t>
                </xpath>
                <xpath expr="//*[hasclass('o-mail-ChatWindow-header')]" position="attributes">
                    <attribute name="t-attf-style" add="color: {{ livechatService.options.title_color }}; background-color: {{ livechatService.options.header_background_color }} !important;" separator=" "/>
                </xpath>
                <xpath expr="//Composer" position="replace">
                    <t t-if="chatbotService.inputEnabled">$0</t>
                    <t t-else="">
                        <span class="bg-200 py-1 text-center fst-italic" t-esc="chatbotService.inputDisabledText"/>
                    </t>
                </xpath>
            </t>
        `
    );
