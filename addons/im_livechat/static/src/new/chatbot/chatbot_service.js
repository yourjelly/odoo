/* @odoo-module */

import { ChatbotStep } from "@im_livechat/new/chatbot/chatbot_step_model";
import { Chatbot } from "@im_livechat/new/chatbot/chatbot_model";
import { SESSION_STATE } from "@im_livechat/new/core/livechat_service";

import { EventBus, reactive } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { debounce } from "@web/core/utils/timing";
import { registry } from "@web/core/registry";

const MESSAGE_DELAY = 500;
// Time between two messages coming from the bot.
const STEP_DELAY = 500;
// Time to wait without user input before considering a multi line
// step as completed.
const MULTILINE_STEP_DEBOUNCE_DELAY = 10000;

export class ChatBotService {
    /** @type {import("@im_livechat/new/chatbot/chatbot_model").Chatbot} */
    chatbot;
    /** @type {import("@im_livechat/new/chatbot/chatbot_step_model").ChatbotStep} */
    currentStep;
    /** @type {number} */
    nextStepTimeout;
    isTyping = false;

    constructor(env, services) {
        const self = reactive(this);
        self.setup(env, services);
        return self;
    }

    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {{
     * "im_livechat.livechat": import("@im_livechat/new/core/livechat_service").LivechatService,
     * "mail.message": import("@mail/core/message_service").MessageService,
     * "mail.store": import("@mail/core/store_service").Store,
     * rpc: typeof import("@web/core/network/rpc_service").rpcService.start,
     * }} services
     */
    setup(env, services) {
        this.env = env;
        this.bus = new EventBus();
        this.livechatService = services["im_livechat.livechat"];
        this.messageService = services["mail.message"];
        this.store = services["mail.store"];
        this.rpc = services.rpc;

        this.debouncedProcessUserAnswer = debounce(
            this._processUserAnswer.bind(this),
            MULTILINE_STEP_DEBOUNCE_DELAY
        );
        this.livechatService.initializedDeferred.then(() => {
            this.chatbot = this.livechatService.rule.chatbot
                ? new Chatbot(this.livechatService.rule.chatbot)
                : undefined;
        });
        this.bus.addEventListener("MESSAGE_POST", ({ detail: message }) => {
            if (this.currentStep?.type === "free_input_multi") {
                this.debouncedProcessUserAnswer(message);
            } else {
                this._processUserAnswer(message);
            }
        });
    }

    /**
     * Start the chatbot script.
     */
    start() {
        if (!this.currentStep?.expectAnswer) {
            this._triggerNextStep();
        } else if (this.thread?.isLastMessageFromCustomer) {
            // Answer was posted but is yet to be processed.
            this._processUserAnswer(this.thread.newestMessage);
        }
    }

    /**
     * Stop the chatbot script.
     */
    stop() {
        clearTimeout(this.nextStepTimeout);
    }

    /**
     * Restart the chatbot script if it was completed.
     */
    async restart() {
        if (!this.completed || !this.thread) {
            return;
        }
        await this.rpc("/chatbot/restart", {
            channel_uuid: this.thread.uuid,
            chatbot_script_id: this.chatbot.scriptId,
        });
        this.currentStep = null;
        this.start();
    }

    // =============================================================================
    // SCRIPT PROCESSING
    // =============================================================================

    /**
     * Save the welcome steps on the server.
     */
    postWelcomeSteps() {
        return this.rpc("/chatbot/post_welcome_steps", {
            channel_uuid: this.thread.uuid,
            chatbot_script_id: this.chatbot.scriptId,
        });
    }

    /**
     * Trigger the next step of the script recursivly until the script
     * is completed or the current step expects an answer from the user.
     */
    _triggerNextStep() {
        if (this.completed) {
            return;
        }
        this.isTyping = true;
        this.nextStepTimeout = browser.setTimeout(
            async () => {
                const { step, stepMessage } = await this._getNextStep();
                this.isTyping = false;
                if (!step && this.currentStep) {
                    this.currentStep.isLast = true;
                    return;
                }
                if (stepMessage) {
                    const message = this.messageService.insert(stepMessage);
                    if (!this.thread.hasMessage(message)) {
                        this.thread.messages.push(message);
                    }
                }
                this.currentStep = step;
                if (
                    this.currentStep?.type === "question_email" &&
                    this.thread.isLastMessageFromCustomer
                ) {
                    const { success } = await this.rpc("/chatbot/step/validate_email", {
                        channel_uuid: this.thread.uuid,
                    });
                    this.currentStep.isEmailValid = success;
                }
                this.save();
                if (this.currentStep.expectAnswer) {
                    return;
                }
                browser.setTimeout(
                    () => this._triggerNextStep(),
                    this.thread.isLastMessageFromCustomer ? 0 : STEP_DELAY
                );
            },
            this.currentStep ? MESSAGE_DELAY : 0
        );
    }

    /**
     * Get the next step to process as well as the message posted by the
     * step if any.
     *
     * @returns {Promise<{ step: ChatbotStep?, stepMessage: object?}>}
     */
    async _getNextStep() {
        if (this.currentStep?.expectAnswer) {
            return { step: this.currentStep };
        }
        if (!this.chatbot.welcomeCompleted) {
            const welcomeStep = this.chatbot.nextWelcomeStep;
            return {
                step: new ChatbotStep(welcomeStep),
                stepMessage: {
                    chatbotStep: welcomeStep,
                    id: this.messageService.getNextTemporaryId(),
                    res_id: this.thread.id,
                    model: this.thread.model,
                    author: this.thread.operator,
                },
            };
        }
        const nextStepData = await this.rpc("/chatbot/step/trigger", {
            channel_uuid: this.thread.uuid,
            chatbot_script_id: this.chatbot.scriptId,
        });
        const { chatbot_posted_message, chatbot_step } = nextStepData ?? {};
        return {
            step: chatbot_step ? new ChatbotStep(chatbot_step) : null,
            stepMessage: chatbot_posted_message,
        };
    }

    /**
     * Process the user answer and trigger the next step.
     *
     * @param {import("@mail/core/message_model").Message} message
     */
    async _processUserAnswer(message) {
        if (
            !this.active ||
            message.originThread.localId !== this.thread?.localId ||
            !this.currentStep?.expectAnswer
        ) {
            return;
        }
        const answer = this.currentStep.answers.find(({ label }) => message.body.includes(label));
        const stepMessage = message.originThread.messages.findLast(
            ({ chatbotStep }) => chatbotStep?.id === this.currentStep.id
        );
        stepMessage.chatbotStep.hasAnswer = true;
        this.currentStep.hasAnswer = true;
        this.save();
        if (answer) {
            await this.rpc("/chatbot/answer/save", {
                channel_uuid: this.thread.uuid,
                message_id: stepMessage.id,
                selected_answer_id: answer.id,
            });
        }
        if (answer?.redirectLink) {
            browser.location.assign(answer.redirectLink);
            return;
        }
        this._triggerNextStep();
    }

    // =============================================================================
    // STATE MANAGEMENT
    // =============================================================================

    /**
     * Restore the chatbot from the state saved in the local storage and
     * clear outdated storage.
     */
    async restore() {
        const chatbotStorageKey = `im_livechat.chatbot.state.uuid_${this.livechatService.sessionCookie?.uuid}`;
        const { _chatbotCurrentStep, _chatbot } = JSON.parse(
            browser.localStorage.getItem(chatbotStorageKey) ?? "{}"
        );
        this.currentStep = _chatbotCurrentStep ? new ChatbotStep(_chatbotCurrentStep) : undefined;
        this.chatbot = _chatbot ? new Chatbot(_chatbot) : undefined;
        for (let i = 0; i < browser.localStorage.length; i++) {
            const key = browser.localStorage.key(i);
            if (key !== chatbotStorageKey && key.includes("im_livechat.chatbot.state.uuid_")) {
                browser.localStorage.removeItem(key);
            }
        }
    }

    /**
     * Save the chatbot state in the local storage.
     */
    async save() {
        if (this.livechatService.state !== SESSION_STATE.PERSISTED) {
            return;
        }
        browser.localStorage.setItem(
            `im_livechat.chatbot.state.uuid_${this.thread.uuid}`,
            JSON.stringify({
                _chatbot: this.chatbot,
                _chatbotCurrentStep: this.currentStep,
            })
        );
    }

    // =============================================================================
    // GETTERS
    // =============================================================================

    get active() {
        return this.available && this.thread?.isChatbotThread;
    }

    get available() {
        return Boolean(this.chatbot);
    }

    get completed() {
        return (
            this.currentStep?.operatorFound ||
            (this.currentStep?.isLast && !this.currentStep?.expectAnswer)
        );
    }

    get inputEnabled() {
        if (!this.active || this.currentStep?.operatorFound) {
            return true;
        }
        return (
            !this.isTyping &&
            this.currentStep?.expectAnswer &&
            this.currentStep?.answers.length === 0
        );
    }

    get inputDisabledText() {
        if (this.inputEnabled) {
            return "";
        }
        if (this.completed) {
            return _t("Conversation ended...");
        }
        switch (this.currentStep?.type) {
            case "question_selection":
                return _t("Select an option above");
            default:
                return _t("Say something");
        }
    }

    get shouldRestore() {
        // Use the uuid of the session cookie since the thread might not
        // be created yet.
        return Boolean(
            localStorage.getItem(
                `im_livechat.chatbot.state.uuid_${this.livechatService.sessionCookie?.uuid}`
            )
        );
    }

    get thread() {
        return this.store.livechatThread;
    }
}

export const chatBotService = {
    dependencies: ["im_livechat.livechat", "mail.message", "mail.store", "rpc"],
    start(env, services) {
        return new ChatBotService(env, services);
    },
};
registry.category("services").add("im_livechat.chatbot", chatBotService);
