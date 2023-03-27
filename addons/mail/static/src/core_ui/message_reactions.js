/** @odoo-module */

import { Component, useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import { _t } from "@web/core/l10n/translation";
import { useStore } from "../core/messaging_hook";

export class MessageReactions extends Component {
    static props = ["message"];
    static template = "mail.MessageReactions";

    setup() {
        this.user = useService("user");
        this.messaging = useService("mail.messaging");
        this.services = {
            "mail.store": useStore(),
            "mail.message": useState(useService("mail.message")),
            "mail.message.reaction": useService("mail.message.reaction"),
        };
    }

    getReactionSummary(reaction) {
        const [firstUserName, secondUserName, thirdUserName] = reaction.personas.map(
            ({ name, displayName }) => name || displayName
        );
        switch (reaction.count) {
            case 1:
                return sprintf(_t("%s has reacted with %s"), firstUserName, reaction.content);
            case 2:
                return sprintf(
                    _t("%s and %s have reacted with %s"),
                    firstUserName,
                    secondUserName,
                    reaction.content
                );
            case 3:
                return sprintf(
                    _t("%s, %s, %s have reacted with %s"),
                    firstUserName,
                    secondUserName,
                    thirdUserName,
                    reaction.content
                );
            case 4:
                return sprintf(
                    _t("%s, %s, %s and 1 other person have reacted with %s"),
                    firstUserName,
                    secondUserName,
                    thirdUserName,
                    reaction.content
                );
            default:
                return sprintf(
                    _t("%s, %s, %s and %s other persons have reacted with %s"),
                    firstUserName,
                    secondUserName,
                    thirdUserName,
                    reaction.personas.length - 3,
                    reaction.content
                );
        }
    }

    hasSelfReacted(reaction) {
        return reaction.personas.includes(this.services["mail.store"].self);
    }

    onClickReaction(reaction) {
        if (this.hasSelfReacted(reaction)) {
            this.services["mail.message.reaction"].remove(reaction);
        } else {
            this.services["mail.message.reaction"].add(this.props.message, reaction.content);
        }
    }
}
