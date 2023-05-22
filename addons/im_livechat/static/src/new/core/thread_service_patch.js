/* @odoo-module */

import { SESSION_STATE } from "@im_livechat/new/core/livechat_service";
import { ThreadService, threadService } from "@mail/core/thread_service";
import { createLocalId, onChange } from "@mail/utils/misc";
import { markup } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";

threadService.dependencies.push(
    "im_livechat.livechat",
    "im_livechat.chatbot",
    "mail.chat_window",
    "notification"
);

patch(ThreadService.prototype, "im_livechat", {
    TEMPORARY_ID: "livechat_temporary_thread",

    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {{
     * "im_livechat.chatbot": import("@im_livechat/new/chatbot/chatbot_service").ChatBotService,
     * "im_livechat.livechat": import("@im_livechat/new/core/livechat_service").LivechatService,
     * "mail.chat_window": import("@mail/web/chat_window/chat_window_service").ChatWindowService,
     * notification: typeof import("@web/core/notifications/notification_service").notificationService.start,
     * }} services
     */
    setup(env, services) {
        this._super(env, services);
        this.livechatService = services["im_livechat.livechat"];
        this.chatWindowService = services["mail.chat_window"];
        this.chatbotService = services["im_livechat.chatbot"];
        this.notification = services.notification;
    },

    getMessagePostRoute(thread) {
        if (thread.type !== "livechat") {
            return this._super(...arguments);
        }
        return "/im_livechat/chat_post";
    },

    getMessagePostParams({ thread, body }) {
        if (thread.type !== "livechat") {
            return this._super(...arguments);
        }
        return {
            uuid: thread.uuid,
            message_content: body,
        };
    },

    /**
     * @returns {Promise<import("@mail/core/message_model").Message}
     */
    async post(thread, body, params) {
        const _super = this._super;
        const chatWindow = this.store.chatWindows.find((c) => c.threadLocalId === thread.localId);
        if (this.livechatService.state !== SESSION_STATE.PERSISTED && thread.type === "livechat") {
            thread = await this.getLivechatThread({ persisted: true });
            if (!thread) {
                this.chatWindowService.close(chatWindow);
                return;
            }
            // replace temporary thread by the persisted one.
            chatWindow.thread = thread;
            if (this.chatbotService.active) {
                await this.chatbotService.postWelcomeSteps();
            }
        }
        const message = await _super(thread, body, params);
        if (!message) {
            this.notificationService.add(_t("Session expired... Please refresh and try again."));
            this.chatWindowService.close(chatWindow);
            this.livechatService.leaveSession({ notifyServer: false });
        }
        this.chatbotService.bus.trigger("MESSAGE_POST", message);
        return message;
    },

    async openChat() {
        const thread = await this.getLivechatThread();
        if (!thread) {
            return;
        }
        const chatWindow = this.chatWindowService.insert({
            thread,
            folded: thread.state === "folded",
        });
        chatWindow.autofocus++;
        if (this.chatbotService.active) {
            this.chatbotService.start();
        }
    },

    insert(data) {
        const isUnknown = !(createLocalId(data.model, data.id) in this.store.threads);
        const thread = this._super(...arguments);
        if (thread.type === "livechat" && isUnknown) {
            thread.welcomeMessage = this.messageService.insert({
                id: this.messageService.getNextTemporaryId(),
                body: this.livechatService.options.default_message,
                res_id: thread.id,
                model: thread.model,
                author: thread.operator,
            });
            thread.chatbotTypingMessage = this.messageService.insert({
                id: this.messageService.getNextTemporaryId(),
                res_id: thread.id,
                model: thread.model,
                author: thread.operator,
            });
            onChange(thread, "state", () =>
                this.livechatService.updateSession({ state: thread.state })
            );
            onChange(thread, "seen_message_id", () =>
                this.livechatService.updateSession({ seen_message_id: thread.seen_message_id })
            );
            onChange(thread, "message_unread_counter", () => {
                this.livechatService.updateSession({ channel: thread.channel });
            });
            this.store.livechatThread = thread;
        }
        return thread;
    },

    async update(thread, data) {
        this._super(...arguments);
        if (data.operator_pid) {
            thread.operator = this.personaService.insert({
                type: "partner",
                id: data.operator_pid[0],
                name: data.operator_pid[1],
            });
        }
        thread.chatbotScriptId = data.chatbotScriptId ?? thread.chatbotScriptId;
    },

    avatarUrl(author, thread) {
        if (thread.type !== "livechat") {
            return this._super(...arguments);
        }
        const isFromOperator =
            author && author.id !== this.livechatService.options.current_partner_id;
        if (isFromOperator) {
            return `${session.origin}/im_livechat/operator/${
                author?.id ?? thread.operator.id
            }/avatar`;
        } else if (author) {
            return `${session.origin}/web/image/res.partner/${author.id}/avatar_128`;
        } else {
            return `${session.origin}/mail/static/src/img/smiley/avatar.jpg`;
        }
    },

    /**
     * @param {Object} param0
     * @param {boolean} param0.persisted
     * @returns {Promise<import("@mail/core/thread_model").Thread?>}
     */
    async getLivechatThread({ persisted = false } = {}) {
        const session = await this.livechatService.getSession({ persisted });
        if (!session?.operator_pid) {
            this.notification.add(_t("No available collaborator, please try again later."));
            return;
        }
        const thread = this.insert({
            ...session,
            id: session.id ?? this.TEMPORARY_ID,
            model: "discuss.channel",
            type: "livechat",
        });
        if (session.messages) {
            thread.messages = session.messages.map((message) => {
                if (message.parentMessage) {
                    message.parentMessage.body = markup(message.parentMessage.body);
                }
                message.body = markup(message.body);
                return this.messageService.insert(message);
            });
        }
        return thread;
    },
});
