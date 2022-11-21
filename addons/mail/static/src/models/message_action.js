/** @odoo-module **/

import { attr, clear, one, Model } from "@mail/model";

Model({
    name: "MessageAction",
    identifyingMode: "xor",
    fields: {
        isNonCompactActionContribution: attr({
            compute() {
                if (this.messageActionListOwnerAsToggleCompact) {
                    return 0;
                }
                return 1;
            },
        }),
        messageActionListOwner: one("MessageActionList", {
            inverse: "messageActions",
            required: true,
            compute() {
                if (this.messageActionListOwnerAsDelete) {
                    return this.messageActionListOwnerAsDelete;
                } else if (this.messageActionListOwnerAsEdit) {
                    return this.messageActionListOwnerAsEdit;
                } else if (this.messageActionListOwnerAsMarkAsRead) {
                    return this.messageActionListOwnerAsMarkAsRead;
                } else if (this.messageActionListOwnerAsReaction) {
                    return this.messageActionListOwnerAsReaction;
                } else if (this.messageActionListOwnerAsReplyTo) {
                    return this.messageActionListOwnerAsReplyTo;
                } else if (this.messageActionListOwnerAsToggleCompact) {
                    return this.messageActionListOwnerAsToggleCompact;
                } else if (this.messageActionListOwnerAsToggleStar) {
                    return this.messageActionListOwnerAsToggleStar;
                } else if (this.messageActionListOwnerAsUnfollow) {
                    return this.messageActionListOwnerAsUnfollow;
                }
                return clear();
            },
        }),
        messageActionListOwnerAsDelete: one("MessageActionList", {
            identifying: true,
            inverse: "actionDelete",
        }),
        messageActionListOwnerAsEdit: one("MessageActionList", {
            identifying: true,
            inverse: "actionEdit",
        }),
        messageActionListOwnerAsMarkAsRead: one("MessageActionList", {
            identifying: true,
            inverse: "actionMarkAsRead",
        }),
        messageActionListOwnerAsReaction: one("MessageActionList", {
            identifying: true,
            inverse: "actionReaction",
        }),
        messageActionListOwnerAsReplyTo: one("MessageActionList", {
            identifying: true,
            inverse: "actionReplyTo",
        }),
        messageActionListOwnerAsToggleCompact: one("MessageActionList", {
            identifying: true,
            inverse: "actionToggleCompact",
        }),
        messageActionListOwnerAsToggleStar: one("MessageActionList", {
            identifying: true,
            inverse: "actionToggleStar",
        }),
        messageActionListOwnerAsUnfollow: one("MessageActionList", {
            identifying: true,
            inverse: "actionUnfollow",
        }),
        messageActionView: one("MessageActionView", {
            inverse: "messageAction",
            compute() {
                /**
                 * Case 0: Always display Reaction and ToggleCompact if they are existing.
                 * Case 1: If ToggleCompact doesn't exist in the action list, display the action.
                 * Case 2: If ToggleCompact exists in the action list and
                 *         the action list is not in the compact mode, display the action.
                 * Others: Do not display the action in the action list.
                 */
                if (
                    this.messageActionListOwnerAsReaction ||
                    this.messageActionListOwnerAsToggleCompact ||
                    (this.messageActionListOwner &&
                        !this.messageActionListOwner.actionToggleCompact) ||
                    (this.messageActionListOwner &&
                        this.messageActionListOwner.actionToggleCompact &&
                        !this.messageActionListOwner.isCompact)
                ) {
                    return {};
                }
                return clear();
            },
        }),
        /**
         * States the listing sequence of the action inside of the aciton list.
         */
        sequence: attr({
            compute() {
                switch (this.messageActionListOwner) {
                    case this.messageActionListOwnerAsDelete:
                        return 5;
                    case this.messageActionListOwnerAsEdit:
                        return 4;
                    case this.messageActionListOwnerAsMarkAsRead:
                        return 3;
                    case this.messageActionListOwnerAsReaction:
                        return 0;
                    case this.messageActionListOwnerAsReplyTo:
                        return 2;
                    case this.messageActionListOwnerAsToggleCompact:
                        return 6;
                    case this.messageActionListOwnerAsToggleStar:
                        return 1;
                    case this.messageActionListOwnerAsUnfollow:
                        return 7;
                    default:
                        return clear();
                }
            },
        }),
    },
});
