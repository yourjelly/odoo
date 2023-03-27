/** @odoo-module */

import { markup } from "@odoo/owl";
import { registry } from "@web/core/registry";

const FETCH_MSG_LIMIT = 30;

export class ThreadMessageFetchService {
    constructor(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.services = {
            /** @type {import("@mail/core/message_service").MessageService} */
            "mail.message": services["mail.message"],
            /** @type {import("@mail/core/thread_service").ThreadService} */
            "mail.thread": services["mail.thread"],
        };
    }

    /**
     * @param {Thread} thread
     */
    async fetchNewMessages(thread) {
        if (thread.status === "loading" || (thread.isLoaded && thread.model === "mail.channel")) {
            return;
        }
        const min = thread.isLoaded ? thread.mostRecentNonTransientMessage?.id : undefined;
        try {
            const fetchedMsgs = await this.fetchMessages(thread, { min });
            Object.assign(thread, {
                loadMore:
                    min === undefined && fetchedMsgs.length === FETCH_MSG_LIMIT
                        ? true
                        : min === undefined && fetchedMsgs.length !== FETCH_MSG_LIMIT
                        ? false
                        : thread.loadMore,
            });
        } catch {
            // handled in fetchMessages
        }
    }

    /**
     * @param {Thread} thread
     */
    async fetchMoreMessages(thread) {
        if (thread.status === "loading") {
            return;
        }
        try {
            const fetchedMsgs = await this.fetchMessages(thread, {
                max: thread.oldestNonTransientMessage?.id,
            });
            if (fetchedMsgs.length < FETCH_MSG_LIMIT) {
                thread.loadMore = false;
            }
        } catch {
            // handled in fetchMessages
        }
    }

    /**
     * @param {Thread} thread
     * @param {{min: Number, max: Number}}
     */
    async fetchMessages(thread, { min, max } = {}) {
        thread.status = "loading";
        if (thread.type === "chatter" && !thread.id) {
            return [];
        }
        const route = (() => {
            if (thread.model === "mail.channel") {
                return "/mail/channel/messages";
            }
            switch (thread.type) {
                case "chatter":
                    return "/mail/thread/messages";
                case "mailbox":
                    return `/mail/${thread.id}/messages`;
                default:
                    throw new Error(`Unknown thread type: ${thread.type}`);
            }
        })();
        const params = (() => {
            if (thread.model === "mail.channel") {
                return { channel_id: thread.id };
            }
            if (thread.type === "chatter") {
                return {
                    thread_id: thread.id,
                    thread_model: thread.model,
                };
            }
            return {};
        })();
        try {
            const rawMessages = await this.rpc(route, {
                ...params,
                limit: FETCH_MSG_LIMIT,
                max_id: max,
                min_id: min,
            });
            const messages = rawMessages.reverse().map((data) => {
                if (data.parentMessage) {
                    data.parentMessage.body = data.parentMessage.body
                        ? markup(data.parentMessage.body)
                        : data.parentMessage.body;
                }
                return this.services["mail.message"].insert(
                    Object.assign(data, { body: data.body ? markup(data.body) : data.body }),
                    true
                );
            });
            this.services["mail.thread"].update(thread, { isLoaded: true });
            return messages;
        } catch (e) {
            thread.hasLoadingFailed = true;
            throw e;
        } finally {
            thread.status = "ready";
        }
    }
}

export const threadMessageFetchService = {
    dependencies: ["rpc", "mail.thread", "mail.message", "mail.persona"],
    start(env, services) {
        return new ThreadMessageFetchService(env, services);
    },
};

registry.category("services").add("mail.thread.message_fetch", threadMessageFetchService);
