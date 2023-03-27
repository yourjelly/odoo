/** @odoo-module */

import { markup } from "@odoo/owl";
import { Message } from "./message_model";
import { removeFromArrayWithPredicate } from "../utils/arrays";
import { convertBrToLineBreak, prettifyMessageContent } from "../utils/format";
import { registry } from "@web/core/registry";
import { LinkPreview } from "./link_preview_model";
import { assignDefined, createLocalId } from "../utils/misc";

const commandRegistry = registry.category("mail.channel_commands");

const { DateTime } = luxon;

export class MessageService {
    constructor(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.orm = services.orm;
        this.userService = services.user;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
            /** @type {import("@mail/core/persona_service").PersonaService} */
            "mail.persona": services["mail.persona"],
            /** @type {import("@mail/attachments/attachment_service").AttachmentService} */
            "mail.attachment": services["mail.attachment"],
        };
        this.env.bus.addEventListener(
            "mail.messaging/notification",
            ({ detail: { notification } }) => {
                switch (notification.type) {
                    case "mail.message/delete": {
                        for (const messageId of notification.payload.message_ids) {
                            const message = this.services["mail.store"].messages[messageId];
                            if (!message) {
                                continue;
                            }
                            if (message.isNeedaction) {
                                removeFromArrayWithPredicate(
                                    this.services["mail.store"].discuss.inbox.messages,
                                    ({ id }) => id === message.id
                                );
                                this.services["mail.store"].discuss.inbox.counter--;
                            }
                            if (message.isStarred) {
                                removeFromArrayWithPredicate(
                                    this.services["mail.store"].discuss.starred.messages,
                                    ({ id }) => id === message.id
                                );
                                this.services["mail.store"].discuss.starred.counter--;
                            }
                            delete this.services["mail.store"].messages[messageId];
                            if (message.originThread) {
                                removeFromArrayWithPredicate(
                                    message.originThread.messages,
                                    ({ id }) => id === message.id
                                );
                            }
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        );
    }

    async update(message, body, attachments = [], rawMentions) {
        if (convertBrToLineBreak(message.body) === body && attachments.length === 0) {
            return;
        }
        const validMentions = this.getMentionsFromText(rawMentions, body);
        const data = await this.rpc("/mail/message/update_content", {
            attachment_ids: attachments
                .map(({ id }) => id)
                .concat(message.attachments.map(({ id }) => id)),
            body: await prettifyMessageContent(body, validMentions),
            message_id: message.id,
        });
        message.body = markup(data.body);
        message.attachments.push(...attachments);
    }

    async delete(message) {
        if (message.isStarred) {
            this.services["mail.store"].discuss.starred.counter--;
            removeFromArrayWithPredicate(
                this.services["mail.store"].discuss.starred.messages,
                ({ id }) => id === message.id
            );
        }
        message.body = "";
        message.attachments = [];
        return this.rpc("/mail/message/update_content", {
            attachment_ids: [],
            body: "",
            message_id: message.id,
        });
    }

    getCommandFromText(thread, content) {
        if (content.startsWith("/")) {
            const firstWord = content.substring(1).split(/\s/)[0];
            const command = commandRegistry.get(firstWord, false);
            if (command) {
                return command.channel_types?.includes(thread.type) || thread.isChannel
                    ? command
                    : false;
            }
        }
    }

    /**
     * @returns {number}
     */
    getLastMessageId() {
        return Object.values(this.services["mail.store"].messages).reduce(
            (lastMessageId, message) => Math.max(lastMessageId, message.id),
            0
        );
    }

    getMentionsFromText(rawMentions, body) {
        if (!this.services["mail.store"].user) {
            // mentions are not supported for guests
            return {};
        }
        const validMentions = {};
        const partners = [];
        const threads = [];
        const rawMentionedPartnerIds = rawMentions.partnerIds || [];
        const rawMentionedThreadIds = rawMentions.threadIds || [];
        for (const partnerId of rawMentionedPartnerIds) {
            const partner =
                this.services["mail.store"].personas[createLocalId("partner", partnerId)];
            const index = body.indexOf(`@${partner.name}`);
            if (index === -1) {
                continue;
            }
            partners.push(partner);
        }
        for (const threadId of rawMentionedThreadIds) {
            const thread =
                this.services["mail.store"].threads[createLocalId("mail.channel", threadId)];
            const index = body.indexOf(`#${thread.displayName}`);
            if (index === -1) {
                continue;
            }
            threads.push(thread);
        }
        validMentions.partners = partners;
        validMentions.threads = threads;
        return validMentions;
    }

    /**
     * Create a transient message, i.e. a message which does not come
     * from a member of the channel. Usually a log message, such as one
     * generated from a command with ('/').
     *
     * @param {Object} data
     */
    createTransient(data) {
        const { body, res_id, model } = data;
        const lastMessageId = this.getLastMessageId();
        this.insert({
            author: this.services["mail.store"].partnerRoot,
            body,
            id: lastMessageId + 0.01,
            is_note: true,
            is_transient: true,
            res_id,
            model,
        });
    }

    async setDone(message) {
        await this.orm.silent.call("mail.message", "set_message_done", [[message.id]]);
    }

    /**
     * @param {Object} data
     * @param {boolean} [fromFetch=false]
     * @returns {Message}
     */
    insert(data, fromFetch = false) {
        let message;
        if (data.res_id) {
            // FIXME this prevents cyclic dependencies between mail.thread and mail.message
            this.env.bus.trigger("mail.thread/insert", {
                model: data.model,
                id: data.res_id,
            });
        }
        if (data.id in this.services["mail.store"].messages) {
            message = this.services["mail.store"].messages[data.id];
        } else {
            message = new Message();
            message._store = this.services["mail.store"];
            message = this.services["mail.store"].messages[data.id] = message;
        }
        this._update(message, data, fromFetch);
        // return reactive version
        return message;
    }

    /**
     * @param {import("@mail/core/message_model").Message} message
     * @param {Object} data
     * @param {boolean} [fromFetch=false]
     */
    _update(message, data, fromFetch = false) {
        const {
            attachment_ids: attachments = message.attachments,
            default_subject: defaultSubject = message.defaultSubject,
            is_discussion: isDiscussion = message.isDiscussion,
            is_note: isNote = message.isNote,
            is_transient: isTransient = message.isTransient,
            linkPreviews = message.linkPreviews,
            message_type: type = message.type,
            model: resModel = message.resModel,
            res_id: resId = message.resId,
            subtype_description: subtypeDescription = message.subtypeDescription,
            ...remainingData
        } = data;
        assignDefined(message, remainingData);
        assignDefined(message, {
            attachments: attachments.map((attachment) =>
                this.services["mail.attachment"].insert({ message, ...attachment })
            ),
            defaultSubject,
            isDiscussion,
            isNote,
            isStarred: this.services["mail.store"].user
                ? message.starred_partner_ids.includes(this.services["mail.store"].user.id)
                : false,
            isTransient,
            linkPreviews: linkPreviews.map((data) => new LinkPreview(data)),
            parentMessage: message.parentMessage ? this.insert(message.parentMessage) : undefined,
            resId,
            resModel,
            subtypeDescription,
            type,
        });
        if (
            Array.isArray(message.author) &&
            message.author.some((command) => command.includes("clear"))
        ) {
            message.author = undefined;
        }
        if (data.author?.id) {
            message.author = this.services["mail.persona"].insert({
                ...data.author,
                type: "partner",
            });
        }
        if (data.guestAuthor?.id) {
            message.author = this.services["mail.persona"].insert({
                ...data.guestAuthor,
                type: "guest",
                channelId: message.originThread.id,
            });
        }
        if (data.recipients) {
            message.recipients = data.recipients.map((recipient) =>
                this.services["mail.persona"].insert({ ...recipient, type: "partner" })
            );
        }
        if (data.record_name) {
            message.originThread.name = data.record_name;
        }
        if (data.res_model_name) {
            message.originThread.modelName = data.res_model_name;
        }
        if (message.originThread && !message.originThread.messages.includes(message)) {
            message.originThread.messages.push(message);
            this.sortMessages(message.originThread);
        }
        if (
            message.isNeedaction &&
            !this.services["mail.store"].discuss.inbox.messages.includes(message)
        ) {
            if (!fromFetch) {
                this.services["mail.store"].discuss.inbox.counter++;
                if (message.originThread) {
                    message.originThread.message_needaction_counter++;
                }
            }
            this.services["mail.store"].discuss.inbox.messages.push(message);
            this.sortMessages(this.services["mail.store"].discuss.inbox);
        }
        if (
            message.isStarred &&
            !this.services["mail.store"].discuss.starred.messages.includes(message)
        ) {
            this.services["mail.store"].discuss.starred.messages.push(message);
            this.sortMessages(this.services["mail.store"].discuss.starred);
        }
        if (
            message.isHistory &&
            !this.services["mail.store"].discuss.history.messages.includes(message)
        ) {
            this.services["mail.store"].discuss.history.messages.push(message);
            this.sortMessages(this.services["mail.store"].discuss.history);
        }
        this.env.bus.trigger("mail.message/updating", { message, data });
    }

    /**
     * @param {import("@mail/core/thread_model").Thread} thread
     */
    sortMessages(thread) {
        thread.messages.sort((msg1, msg2) => {
            return msg1.id - msg2.id;
        });
    }

    scheduledDateSimple(message) {
        return message.scheduledDate.toLocaleString(DateTime.TIME_SIMPLE, {
            locale: this.userService.lang.replace("_", "-"),
        });
    }

    dateSimple(message) {
        return message.datetime.toLocaleString(DateTime.TIME_SIMPLE, {
            locale: this.userService.lang.replace("_", "-"),
        });
    }
}

export const messageService = {
    dependencies: ["mail.store", "rpc", "orm", "user", "mail.persona", "mail.attachment"],
    start(env, services) {
        return new MessageService(env, services);
    },
};

registry.category("services").add("mail.message", messageService);
