/** @odoo-module */

import { makeDeferred } from "@mail/utils/deferred";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { session } from "@web/session";

import { qweb } from "web.core";

class PublicLivechat {
    HISTORY_LIMIT = 15;
    HISTORY_COOKIE = "im_livechat_history";
    hasLoadedQweb = false;
    history = [];
    isAvailableForMe = false;
    isStarted = makeDeferred();
    session;

    constructor(env, { cookie, "mail.message": messageService, rpc }) {
        this.messageService = messageService;
        this.rpc = rpc;
        this.cookie = cookie;
        const { isAvailable, serverUrl, options } = session.livechatData || {};
        this.isAvailable = isAvailable;
        this.serverUrl = serverUrl;
        this.options = options ?? {};

        // PAGE HISTORY TRACKING
        const page = browser.location.href.replace(/^.*\/\/[^/]+/, "");
        const history = JSON.parse(this.cookie.current[this.HISTORY_COOKIE] ?? "[]");
        if (!history.includes(page)) {
            history.push(page);
        }
        history.splice(0, history.length - this.HISTORY_LIMIT);
        this.cookie.setCookie(this.HISTORY_COOKIE, JSON.stringify(history), 60 * 60 * 24); // 1 day cookie.

        if (this.isAvailable) {
            this.start();
        }
    }

    async loadQWebTemplates() {
        const templates = await this.rpc("/im_livechat/load_templates");
        for (const template of templates) {
            qweb.add_template(template);
        }
        this.hasLoadedQweb = true;
    }

    async start() {
        const sessionCookie = this.cookie.current["im_livechat_session"];
        const isSessionInitialized = Boolean(sessionCookie);
        if (isSessionInitialized) {
            this.session = JSON.parse(sessionCookie);
        }
        if (this.session?.id) {
            // Channel is already created on the server, let's retrieve the chat
            // history.
            const messageHistory = await this.rpc("/mail/chat_history", {
                uuid: this.session.uuid,
                limit: 100,
            });
            for (const message of messageHistory) {
                this.history.push(this.messageService.insert(message));
            }
            this.history.reverse();
        } else {
            // First time visitor or not yet created channel.
            const result = await this.rpc("/im_livechat/init", {
                channel_id: this.options.channel_id,
            });
            if (result.available_for_me) {
                this.isAvailableForMe = true;
            }
            this.rule = result.rule;
        }
        this.isAvailableForMe = this.isAvailableForMe || isSessionInitialized;
        this.loadQWebTemplates();
        this.isStarted.resolve();
    }
}

const publicLivechatService = {
    dependencies: ["cookie", "mail.message", "rpc"],

    start(env, services) {
        return new PublicLivechat(env, services);
    },
};

registry.category("services").add("public_livechat", publicLivechatService);
