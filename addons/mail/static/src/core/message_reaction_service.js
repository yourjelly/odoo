/** @odoo-module */

import { registry } from "@web/core/registry";
import { MessageReactions } from "./message_reactions_model";

export class MessageReactionService {
    constructor(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.services = {
            /** @type {import("@mail/core/message_service").MessageService} */
            "mail.message": services["mail.message"],
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
            /** @type {import("@mail/core/persona_service").PersonaService} */
            "mail.persona": services["mail.persona"],
        };
        this.env.bus.addEventListener("mail.message/updating", ({ detail: { message, data } }) => {
            const reactionContentToUnlink = new Set();
            const reactionsToInsert = [];
            for (const rawReaction of data.reactionGroups ?? []) {
                const [command, reactionData] = Array.isArray(rawReaction)
                    ? rawReaction
                    : ["insert", rawReaction];
                const reaction = this.insert(reactionData);
                if (command === "insert") {
                    reactionsToInsert.push(reaction);
                } else {
                    reactionContentToUnlink.add(reaction.content);
                }
            }
            message.reactions = message.reactions.filter(
                ({ content }) => !reactionContentToUnlink.has(content)
            );
            reactionsToInsert.forEach((reaction) => {
                const idx = message.reactions.findIndex(
                    ({ content }) => reaction.content === content
                );
                if (idx !== -1) {
                    message.reactions[idx] = reaction;
                } else {
                    message.reactions.push(reaction);
                }
            });
        });
    }

    /**
     * @param {Object} data
     * @returns {MessageReactions}
     */
    insert(data) {
        let reaction = this.services["mail.store"].messages[data.message.id]?.reactions.find(
            ({ content }) => content === data.content
        );
        if (!reaction) {
            reaction = new MessageReactions();
            reaction._store = this.services["mail.store"];
        }
        const personasToUnlink = new Set();
        const alreadyKnownPersonaIds = new Set(reaction.personaLocalIds);
        for (const rawPartner of data.partners) {
            const [command, partnerData] = Array.isArray(rawPartner)
                ? rawPartner
                : ["insert", rawPartner];
            const persona = this.services["mail.persona"].insert({
                ...partnerData,
                type: "partner",
            });
            if (command === "insert" && !alreadyKnownPersonaIds.has(persona.localId)) {
                reaction.personaLocalIds.push(persona.localId);
            } else if (command !== "insert") {
                personasToUnlink.add(persona.localId);
            }
        }
        Object.assign(reaction, {
            count: data.count,
            content: data.content,
            messageId: data.message.id,
            personaLocalIds: reaction.personaLocalIds.filter(
                (localId) => !personasToUnlink.has(localId)
            ),
        });
        return reaction;
    }

    async add(message, content) {
        const messageData = await this.rpc(
            "/mail/message/add_reaction",
            {
                content,
                message_id: message.id,
            },
            { silent: true }
        );
        this.services["mail.message"].insert(messageData);
    }

    async remove(reaction) {
        const messageData = await this.rpc(
            "/mail/message/remove_reaction",
            {
                content: reaction.content,
                message_id: reaction.messageId,
            },
            { silent: true }
        );
        this.services["mail.message"].insert(messageData);
    }
}

export const messageReactionService = {
    dependencies: ["rpc", "mail.message", "mail.store", "mail.persona"],
    start(env, services) {
        return new MessageReactionService(env, services);
    },
};

registry.category("services").add("mail.message.reaction", messageReactionService);
