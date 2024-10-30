import { Component, useRef } from "@odoo/owl";
import { Message } from "./message_model";
import { usePopover } from "@web/core/popover/popover_hook";
import { EmojiPicker } from "@web/core/emoji_picker/emoji_picker";
import { ReactionMenu } from "./reaction_menu_component";

/**
 * @typedef {Object} Props
 * @extends {Component<Props, Env>}
 */
export class AddReactionMenu extends Component {
    static template = "mail.AddReactionMenu";
    static props = {
        messageActive: { type: Boolean, optionnal: true },
        message: Message,
    };
    static components = {};

    setup() {
        this.toggle = useRef("toggle");
        this.popover = usePopover(ReactionMenu, {
            arrow: false,
            popoverClass: "o-mail-AddReactionMenu-quickActionsPopover",
            position: "top-middle",
        });
        this.picker = usePopover(EmojiPicker, {
            position: "bottom-end",
            popoverClass: "o-mail-AddReactionMenu-pickerPopover",
            arrow: false,
            animation: false,
        });
    }

    openEmojiPicker() {
        this.popover.close();
        this.picker.open(this.toggle.el, {
            onSelect: (emoji) => this.props.message.toggleReaction(emoji),
        });
    }

    onClick() {
        if (this.picker.isOpen) {
            this.picker.close();
            return;
        }
        this.popover.isOpen
            ? this.popover.close()
            : this.popover.open(this.toggle.el, {
                  message: this.props.message,
                  openEmojiPicker: this.openEmojiPicker.bind(this),
                  toggleReaction: this.toggleReaction.bind(this),
              });
    }

    toggleReaction(emoji) {
        this.props.message.toggleReaction(emoji);
        this.popover.close();
    }
}
