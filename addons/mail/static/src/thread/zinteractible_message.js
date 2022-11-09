/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
import { MessageDeleteDialog } from '@mail/thread/message_delete_dialog';
import { Message } from "./message";

export class InteractibleMessage extends Component {
    static template = "mail.interactible_message";
    static components = { Message };
    static props = ['squashed?', 'message'];

    setup() {
        this.messaging = useMessaging();
        this.action = useService("action");
        this.message = this.props.message;
        this.author = this.messaging.partners[this.message.authorId];
        this.user = useService("user");
    }

    get canBeDeleted() {
        if (!this.user.isAdmin && this.message.authorId !== this.messaging.user.partnerId) {
            return false;
        }
        if (this.message.type !== "comment") {
            return false;
        }
        return this.message.isNote || this.message.resModel === "mail.channel";
    }

    toggleStar() {
        this.messaging.toggleStar(this.props.message.id);
    }

    onClickDelete() {
        this.env.services.dialog.add(MessageDeleteDialog, {
            message: this.message,
        });
    }
}
