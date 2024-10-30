import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Message } from "./message_model";

/**
 * @typedef {Object} Props
 * @extends {Component<Props, Env>}
 */
export class ReactionMenu extends Component {
    static template = "mail.ReactionMenu"; // TODO TSM - mail.QuickReactions
    static props = {
        message: Message,
        close: Function,
        openEmojiPicker: Function,
        toggleReaction: Function,
    };

    setup() {
        this.store = useState(useService("mail.store"));
        this.frequentEmojiService = useState(useService("mail.frequent.emoji"));
    }
    reactedBySelf(emoji) {
        return this.props.message.reactions.some(
            (reaction) => reaction.content === emoji && this.store.self.in(reaction.personas)
        );
    }
}
