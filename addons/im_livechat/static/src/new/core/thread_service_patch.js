/** @odoo-module */

import { ThreadService, threadService } from "@mail/core/thread_service";
import { createLocalId } from "@mail/utils/misc";
import { markup } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";

threadService.dependencies.push("im_livechat.livechat", "mail.chat_window", "notification");

patch(ThreadService.prototype, "im_livechat", {
    TEMPORARY_ID: "livechat_temporary_thread",

    setup(env, services) {
        this._super(env, services);
        this.livechatService = services["im_livechat.livechat"];
        this.chatWindowService = services["mail.chat_window"];
        this.notification = services.notification;
    },

    getMessagePostRoute(thread) {
        if (thread.type === "livechat") {
            return "/im_livechat/chat_post";
        }
        return this._super(thread);
    },

    getMessagePostParams({ thread, body }) {
        if (thread.type !== "livechat") {
            return this._super(thread, body);
        }
        return {
            uuid: thread.uuid,
            message_content: body,
        };
    },

    async post(thread, body, params) {
        const _super = this._super;
        const session = await this.livechatService.getSession({ persisted: true });
        const chatWindow = this.store.chatWindows.find(
            (chatWindow) =>
                chatWindow.thread.localId === createLocalId("discuss.channel", this.TEMPORARY_ID) ||
                chatWindow.thread.localId === thread.localId
        );
        if (!session) {
            this.notification.add(_t("No available collaborator, please try again later."));
            this.chatWindowService.close(chatWindow);
            return;
        }
        if (!thread.uuid) {
            // replace temporary thread by the persisted one.
            thread = this.insert({
                ...session,
                model: "discuss.channel",
                type: "livechat",
            });
            chatWindow.thread = thread;
        }
        return _super(thread, body, params);
    },

    async openChat() {
        const session = await this.livechatService.getSession();
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
        this.chatWindowService.insert({ thread, folded: thread.state === "folded" });
    },

    insert(data) {
        const isUnknown = !(createLocalId(data.model, data.id) in this.store.threads);
        const thread = this._super(data);
        if (thread.type === "livechat" && isUnknown) {
            thread.welcomeMessage = this.messageService.insert({
                id: -1,
                body: this.livechatService.options.default_message,
                res_id: thread.id,
                model: thread.model,
                author: thread.operator,
            });
        }
        return thread;
    },

    async update(thread, data) {
        this._super(thread, data);
        if (data?.operator_pid) {
            thread.operator = this.personaService.insert({
                type: "partner",
                id: data.operator_pid[0],
                name: data.operator_pid[1],
            });
        }
    },

    avatarUrl(author, thread) {
        if (thread?.type !== "livechat") {
            return this._super(author, thread);
        }
        if (author?.id === thread.operator.id && author.type === thread.operator.type) {
            return `${session.origin}/im_livechat/operator/${thread.operator.id}/avatar`;
        } else if (author) {
            return `${session.origin}/web/image/res.partner/${author.id}/avatar_128`;
        } else {
            return `${session.origin}/mail/static/src/img/smiley/avatar.jpg`;
        }
    },

    /**
     * Returns the current livechat thread if any.
     *
     * @returns {Promise<@import("@mail/core/thread_model").Thread?>}
     */
    async getLivechatThread() {
        const session = await this.livechatService.getSession();
        if (!session) {
            return;
        }
        return this.store.threads[
            createLocalId("discuss.channel", session.id ?? this.TEMPORARY_ID)
        ];
    },
});
