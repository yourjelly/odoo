/** @odoo-module */

import { Attachment } from "./attachment_model";
import { assignDefined, createLocalId } from "../utils/misc";
import { registry } from "@web/core/registry";
import { removeFromArrayWithPredicate } from "../utils/arrays";

export class AttachmentService {
    constructor(env, services) {
        this.env = env;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
        };
        this.rpc = services["rpc"];
        this.env.bus.addEventListener(
            "mail.messaging/notification",
            ({ detail: { notification } }) => {
                switch (notification.type) {
                    case "ir.attachment/delete":
                        {
                            const attachment =
                                this.services["mail.store"].attachments[notification.payload.id];
                            if (!attachment) {
                                return;
                            }
                            this.remove(attachment);
                        }
                        break;
                    default:
                        break;
                }
            }
        );
    }

    insert(data) {
        if (!("id" in data)) {
            throw new Error("Cannot insert attachment: id is missing in data");
        }
        if (data.id in this.services["mail.store"].attachments) {
            const attachment = this.services["mail.store"].attachments[data.id];
            this.update(attachment, data);
            return attachment;
        }
        const attachment = (this.services["mail.store"].attachments[data.id] = new Attachment());
        Object.assign(attachment, { _store: this.services["mail.store"], id: data.id });
        this.update(attachment, data);
        return attachment;
    }

    update(attachment, data) {
        assignDefined(attachment, data, [
            "checksum",
            "filename",
            "mimetype",
            "name",
            "type",
            "url",
            "uploading",
            "extension",
            "accessToken",
            "tmpUrl",
            "message",
        ]);
        if (!("extension" in data) && data["name"]) {
            attachment.extension = attachment.name.split(".").pop();
        }
        if (data.originThread !== undefined) {
            const threadData = Array.isArray(data.originThread)
                ? data.originThread[0][1]
                : data.originThread;
            // FIXME this prevents cyclic dependencies between mail.thread and mail.message
            this.env.bus.trigger("mail.thread/insert", {
                model: threadData.model,
                id: threadData.id,
            });
            attachment.originThreadLocalId = createLocalId(threadData.model, threadData.id);
            const originThread =
                this.services["mail.store"].threads[attachment.originThreadLocalId];
            if (!originThread.attachments.some((a) => a.id === attachment.id)) {
                originThread.attachments.push(attachment);
            }
        }
    }

    /**
     * Remove the given attachment globally.
     *
     * @param {Attachment} attachment
     */
    remove(attachment) {
        delete this.services["mail.store"].attachments[attachment.id];
        if (attachment.originThread) {
            removeFromArrayWithPredicate(
                attachment.originThread.attachments,
                ({ id }) => id === attachment.id
            );
        }
        for (const message of Object.values(this.services["mail.store"].messages)) {
            removeFromArrayWithPredicate(message.attachments, ({ id }) => id === attachment.id);
            if (message.composer) {
                removeFromArrayWithPredicate(
                    message.composer.attachments,
                    ({ id }) => id === attachment.id
                );
            }
        }
        for (const thread of Object.values(this.services["mail.store"].threads)) {
            removeFromArrayWithPredicate(
                thread.composer.attachments,
                ({ id }) => id === attachment.id
            );
        }
    }

    /**
     * Delete the given attachment on the server as well as removing it
     * globally.
     *
     * @param {Attachment} attachment
     */
    async delete(attachment) {
        this.remove(attachment);
        if (attachment.id > 0) {
            await this.rpc("/mail/attachment/delete", {
                attachment_id: attachment.id,
            });
        }
    }
}

export const attachmentService = {
    dependencies: ["mail.store", "rpc"],
    start(env, services) {
        return new AttachmentService(env, services);
    },
};

registry.category("services").add("mail.attachment", attachmentService);
