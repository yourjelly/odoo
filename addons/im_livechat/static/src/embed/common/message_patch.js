import { FEATURES } from "@im_livechat/embed/common/features";

import { Message } from "@mail/core/common/message";

import { feature } from "@mail/core/common/features";
import { url } from "@web/core/utils/urls";
import { SESSION_STATE } from "./livechat_service";

feature(FEATURES.EMBED_LIVECHAT)
    .registerIIFE(() => Message.props.push("isTypingMessage?"))
    .registerPatch(Message.prototype, {
        setup() {
            super.setup();
            this.url = url;
        },

        get quickActionCount() {
            return this.props.thread?.type === "livechat" ? 2 : super.quickActionCount;
        },

        get canAddReaction() {
            return (
                super.canAddReaction &&
                (this.props.thread?.type !== "livechat" ||
                    this.env.services["im_livechat.livechat"].state === SESSION_STATE.PERSISTED)
            );
        },

        get canReplyTo() {
            return (
                super.canReplyTo &&
                (this.props.thread?.type !== "livechat" ||
                    this.env.services["im_livechat.chatbot"].inputEnabled)
            );
        },

        /**
         * @param {import("@im_livechat/embed/common/chatbot/chatbot_step_model").StepAnswer} answer
         */
        answerChatbot(answer) {
            return this.threadService.post(this.props.message.thread, answer.label);
        },
    })
    .registerTemplateExtension(
        "mail.Message",
        `
            <t t-inherit="mail.Message" t-inherit-mode="extension">
                <xpath expr="//*[@t-ref='messageContent']" position="replace">
                    <div t-if="props.isTypingMessage">
                        <img height="30" t-att-src="url('/im_livechat/static/src/img/chatbot_is_typing.gif')"/>
                    </div>
                    <t t-else="">$0</t>
                </xpath>
                <xpath expr="//*[@t-ref='body']" position="inside">
                    <ul class="p-0 m-0" t-if="props.message.chatbotStep?.answers and !props.message.chatbotStep.selectedAnswer">
                        <li
                            t-foreach="props.message.chatbotStep?.answers" t-as="answer" t-key="answer.id"
                            t-esc="answer.label" t-on-click="() => this.answerChatbot(answer)"
                            class="btn btn-outline-primary d-block mt-2 py-2"
                        />
                    </ul>
                </xpath>
            </t>
        `
    );
