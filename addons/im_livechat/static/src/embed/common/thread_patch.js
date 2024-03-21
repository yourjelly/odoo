import { FEATURES } from "@im_livechat/embed/common/features";
import { feature } from "@mail/core/common/features";

import { Thread } from "@mail/core/common/thread";

import { useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";

feature(FEATURES.EMBED_LIVECHAT)
    .registerPatch(Thread.prototype, {
        setup() {
            super.setup();
            this.chatbotService = useState(useService("im_livechat.chatbot"));
        },
    })
    .registerTemplateExtension(
        "mail.Thread",
        `
            <t t-inherit="mail.Thread" t-inherit-mode="extension">
                <xpath expr="//*[@name='content']" position="before">
                    <div t-if="props.thread?.livechatWelcomeMessage" class="bg-100 py-3">
                        <Message message="props.thread.livechatWelcomeMessage" hasActions="false" thread="props.thread" className="'px-3'"/>
                    </div>
                </xpath>
                <xpath expr="//*[@name='content']" position="after">
                    <Message t-if="props.thread.chatbot?.typingMessage" message="props.thread.chatbot.typingMessage" hasActions="false" isInChatWindow="env.inChatWindow" isTypingMessage="true"  thread="props.thread"/>
                </xpath>
                <xpath expr="//*[hasclass('o-mail-Thread-empty')]" position="replace">
                    <t t-if="props.thread.channel_type !== 'livechat'">$0</t>
                </xpath>
                <xpath expr="//*[hasclass('o-mail-Thread-newMessage')]" position="replace">
                    <t t-if="!chatbotService.chatbot">$0</t>
                </xpath>
            </t>
        `
    )
    .registerTemplateExtension(
        "mail.NotificationMessage",
        `
        <t t-inherit="mail.NotificationMessage" t-inherit-mode="extension">
            <xpath expr="//*[hasclass('o-mail-NotificationMessage')]" position="attributes">
                <attribute name="t-attf-class" add="{{ props.thread.channel_type === 'livechat' ? 'o-livechat-NoPinMenu' : '' }}" separator=" "/>
            </xpath>
        </t>
    `
    );
