/* @odoo-module */

import { useStore } from "@mail/core/common/messaging_hook";

import { Component, useState } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";

export class MessageReactions extends Component {
    static props = ["message", "openReactionMenu"];
    static template = "mail.MessageReactions";

    setup() {
        this.user = useService("user");
        this.messaging = useService("mail.messaging");
        this.store = useStore();
        this.ui = useService("ui");
        this.messageService = useState(useService("mail.message"));
    }

    getReactionSummary(reaction) {
        const [user1, user2, user3] = reaction.personas.map(
            ({ name, displayName }) => name || displayName
        );
        switch (reaction.count) {
            case 1:
                return sprintf(_t("%(user)s has reacted with %(reaction)s"), {
                    user: user1,
                    reaction: reaction.content,
                });
            case 2:
                return sprintf(_t("%(user1)s and %(user2)s have reacted with %(reaction)s"), {
                    user1,
                    user2,
                    reaction: reaction.content,
                });
            case 3:
                return sprintf(
                    _t("%(user1)s, %(user2)s and %(user3)s have reacted with %(reaction)s"),
                    { user1, user2, user3, reaction: reaction.content }
                );
            case 4:
                return sprintf(
                    _t(
                        "%(user1)s, %(user2)s, %(user3)s and 1 other person have reacted with %(reaction)s"
                    ),
                    { user1, user2, user3, reaction: reaction.content }
                );
            default:
                return sprintf(
                    _t(
                        "%(user1)s, %(user2)s, %(user3)s and %(count)s other persons have reacted with %(reaction)s"
                    ),
                    { user1, user2, user3, count: reaction.count - 3, reaction: reaction.content }
                );
        }
    }

    hasSelfReacted(reaction) {
        return reaction.personas.includes(this.store.self);
    }

    onClickReaction(reaction) {
        if (this.hasSelfReacted(reaction)) {
            this.messageService.removeReaction(reaction);
        } else {
            this.messageService.react(this.props.message, reaction.content);
        }
    }

    onContextMenu(ev) {
        if (this.ui.isSmall) {
            ev.preventDefault();
            this.props.openReactionMenu();
        }
    }
}
