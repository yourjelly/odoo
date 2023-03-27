/** @odoo-module */

import { createLocalId } from "@mail/utils/misc";
import { Follower } from "@mail/web/follower_model";
import { parseEmail } from "@mail/js/utils";
import { registry } from "@web/core/registry";
import { markup } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

let nextId = 1;

export class ChatterService {
    constructor(env, services) {
        this.env = env;
        this.services = {
            /** @type {import("@mail/attachments/attachment_service").AttachmentService} */
            "mail.attachment": services["mail.attachment"],
            /** @type {import("@mail/web/activity/activity_service").ActivityService} */
            "mail.activity": services["mail.activity"],
            /** @type {import("@mail/core/messaging_service").MessageService} */
            "mail.message": services["mail.message"],
            /** @type {import("@mail/core/persona_service").PersonaService} */
            "mail.persona": services["mail.persona"],
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
            /** @type {import("@mail/core/thread_service").ThreadService} */
            "mail.thread": services["mail.thread"],
            /** @type {import("@mail/core/thread_message_fetch_service").ThreadMessageFetchService} */
            "mail.thread.message_fetch": services["mail.thread.message_fetch"],
        };
    }

    /**
     * @param {import("@mail/core/thread_model").Thread} thread
     * @param {['activities'|'followers'|'attachments'|'messages'|'suggestedRecipients']} requestList
     */
    async fetchData(
        thread,
        requestList = ["activities", "followers", "attachments", "messages", "suggestedRecipients"]
    ) {
        thread.isLoadingAttachments =
            thread.isLoadingAttachments || requestList.includes("attachments");
        if (requestList.includes("messages")) {
            this.services["mail.thread.message_fetch"].fetchNewMessages(thread);
        }
        const result = await this.rpc("/mail/thread/data", {
            request_list: requestList,
            thread_id: thread.id,
            thread_model: thread.model,
        });
        if ("attachments" in result) {
            result["attachments"] = result["attachments"].map((attachment) => ({
                ...attachment,
                originThread: this.services["mail.thread"].insert(attachment.originThread[0][1]),
            }));
        }
        thread.canPostOnReadonly = result.canPostOnReadonly;
        thread.hasReadAccess = result.hasReadAccess;
        thread.hasWriteAccess = result.hasWriteAccess;
        if ("activities" in result) {
            const existingIds = new Set();
            for (const activity of result.activities) {
                if (activity.note) {
                    activity.note = markup(activity.note);
                }
                existingIds.add(this.services["mail.activity"].insert(activity).id);
            }
            for (const activity of thread.activities) {
                if (!existingIds.has(activity.id)) {
                    this.services["mail.activity"].delete(activity);
                }
            }
        }
        if ("attachments" in result) {
            this.services["mail.thread"].update(thread, {
                areAttachmentsLoaded: true,
                attachments: result.attachments,
                isLoadingAttachments: false,
            });
        }
        if ("mainAttachment" in result) {
            thread.mainAttachment = result.mainAttachment.id
                ? this.services["mail.attachment"].insert(result.mainAttachment)
                : undefined;
        }
        if (!thread.mainAttachment && thread.attachmentsInWebClientView.length > 0) {
            this.services["mail.thread"].setMainAttachmentFromIndex(thread, 0);
        }
        if ("followers" in result) {
            for (const followerData of result.followers) {
                this.insertFollower({
                    followedThread: thread,
                    ...followerData,
                });
            }
        }
        if ("suggestedRecipients" in result) {
            this.insertSuggestedRecipients(thread, result.suggestedRecipients);
        }
        return result;
    }

    getThread(resModel, resId) {
        const localId = createLocalId(resModel, resId);
        if (localId in this.services["mail.store"].threads) {
            if (resId === false) {
                return this.services["mail.store"].threads[localId];
            }
            // to force a reload
            this.services["mail.store"].threads[localId].status = "new";
        }
        const thread = this.services["mail.thread"].insert({
            id: resId,
            model: resModel,
            type: "chatter",
        });
        if (resId === false) {
            const tmpId = `virtual${this.nextId++}`;
            const tmpData = {
                id: tmpId,
                author: { id: this.services["mail.store"].self.id },
                body: _t("Creating a new record..."),
                message_type: "notification",
                trackingValues: [],
                res_id: thread.id,
                model: thread.model,
            };
            this.services["mail.message"].insert(tmpData);
        }
        return thread;
    }

    /**
     * @param {import("@mail/web/follower_model").Data} data
     * @returns {import("@mail/web/follower_model").Follower}
     */
    insertFollower(data) {
        let follower = this.services["mail.store"].followers[data.id];
        if (!follower) {
            this.services["mail.store"].followers[data.id] = new Follower();
            follower = this.services["mail.store"].followers[data.id];
        }
        Object.assign(follower, {
            followedThread: data.followedThread,
            id: data.id,
            isActive: data.is_active,
            partner: this.services["mail.persona"].insert({ ...data.partner, type: "partner" }),
            _store: this.services["mail.store"],
        });
        if (!follower.followedThread.followers.includes(follower)) {
            follower.followedThread.followers.push(follower);
        }
        return follower;
    }

    /**
     * @param {import("@mail/web/follower_model").Follower} follower
     */
    async removeFollower(follower) {
        await this.orm.call(follower.followedThread.model, "message_unsubscribe", [
            [follower.followedThread.id],
            [follower.partner.id],
        ]);
        const index = follower.followedThread.followers.indexOf(follower);
        if (index !== -1) {
            follower.followedThread.followers.splice(index, 1);
        }
        delete this.services["mail.store"].followers[follower.id];
    }

    /**
     * @param {import("@mail/core/thread_model").Thread} thread
     * @param {import("@mail/web/suggested_recipient").SuggestedRecipient[]} dataList
     */
    async insertSuggestedRecipients(thread, dataList) {
        const recipients = [];
        for (const data of dataList) {
            const [partner_id, emailInfo, lang, reason] = data;
            const [name, email] = emailInfo && parseEmail(emailInfo);
            recipients.push({
                id: nextId++,
                name,
                email,
                lang,
                reason,
                persona: partner_id
                    ? this.services["mail.persona"].insert({
                          type: "partner",
                          id: partner_id,
                      })
                    : false,
                checked: partner_id ? true : false,
            });
        }
        thread.suggestedRecipients = recipients;
    }
}

export const chatterService = {
    dependencies: [
        "mail.activity",
        "mail.attachment",
        "mail.message",
        "mail.persona",
        "mail.store",
        "mail.thread",
    ],
    start(env, services) {
        return new ChatterService(env, services);
    },
};

registry.category("services").add("mail.chatter", chatterService);
