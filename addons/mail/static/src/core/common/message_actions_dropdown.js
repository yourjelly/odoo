import { Component, toRaw, useState } from "@odoo/owl";
import { Message } from "./message_model";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { useMessageActions } from "./message_actions";
import { useService } from "@web/core/utils/hooks";
import { MessageReactionMenu } from "./message_reaction_menu";
import { useDropdownState } from "@web/core/dropdown/dropdown_hooks";

/**
 * @typedef {Object} Props
 * @extends {Component<Props, Env>}
 */
export class MessageActionsDropdown extends Component {
    static template = "mail.MessageActionsDropdown";
    static props = {
        message: Message,
        messageActive: { type: Boolean, optionnal: true },
        class: { type: String, optionnal: true },
    };
    static components = { Dropdown, DropdownItem };

    setup() {
        super.setup(...arguments);
        this.store = useState(useService("mail.store"));
        this.messageActions = useMessageActions();
        this.dropdownState = useDropdownState();
    }

    openReactionMenu(reaction) {
        const message = toRaw(this.props.message);
        this.dialog.add(
            MessageReactionMenu,
            { message, initialReaction: reaction },
            { context: this }
        );
    }

    get message() {
        return this.props.message;
    }
}
