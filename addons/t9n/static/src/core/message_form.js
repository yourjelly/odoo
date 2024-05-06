import { Component, useState, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { CopyPopover } from "@t9n/core/copy_button_popover";

export class MessageForm extends Component {
    static props = {};
    static template = "t9n.MessageForm";

    setup() {
        this.state = useState({
            suggestedTranslationText: "",
        });
        this.store = useState(useService("t9n.store"));
        this.orm = useService("orm");
        this.popoverButtonRef = useRef("popover-button");
        this.copyPopover = usePopover(CopyPopover, {
            position: "top",
            animation: true,
            arrow: true,
            closeOnClickAway: true,
        });
    }

    get message() {
        return this.store.active_message;
    }

    get translations() {
        return this.store.active_message.translations;
    }

    onClickClear() {
        this.state.suggestedTranslationText = "";
    }

    async onClickCopy(ev) {
        try {
            await navigator.clipboard.writeText(this.state.suggestedTranslationText.trim());
            this.copyPopover.open(this.popoverButtonRef.el, {});
            setTimeout(() => {
                this.copyPopover.close();
            }, 3000);
        } catch (error) {
            console.error("Error copying text:", error);
        }
    }

    async onClickSuggest() {
        await this.orm.create("t9n.translation", [
            {
                body: this.state.suggestedTranslationText.trim(),
                source_id: this.store.active_message.id,
                lang_id: this.store.target_lang_id,
            },
        ]);
        this.store.fetchActiveMessage();
        this.onClickClear();
    }
}
