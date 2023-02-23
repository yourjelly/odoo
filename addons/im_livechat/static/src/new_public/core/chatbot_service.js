/** @odoo-module */

import { registry } from "@web/core/registry";

class Chatbot {
    constructor(env, { cookie, public_livechat }) {
        this.env = env;
        this.cookie = cookie;
        this.livechat = public_livechat;
    }

    get state() {
        if (this.livechat.rule?.chatbot && this.livechat.session) {
            return "welcome";
        }
        if (this.livechat.history.length > 0 && localStorage.getItem(this.sessionCookieKey)) {
            return "restore_session";
        }
        if (this.livechat.rule?.chatbot) {
            return "init";
        }
        return undefined;
    }

    get sessionCookieKey() {
        if (!this.livechat.session) {
            return undefined;
        }
        return `im_livechat.chatbot.state.uuid_${this.livechat.session.uuid}`;
    }
}

const chatbotService = {
    dependencies: ["cookie", "public_livechat"],

    start(env, services) {
        return new Chatbot(env, services);
    },
};

registry.category("services").add("chatbot", chatbotService);
