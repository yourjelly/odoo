import { Component, useState, useRef } from "@odoo/owl";

import { CopyPopover } from "@t9n/core/copy_button_popover";

import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";

export class MessageForm extends Component {
    static props = {};
    static template = "t9n.MessageForm";

    setup() {
        this.state = useState({
            suggestedTranslationText: "",
        });
        this.store = useState(useService("mail.store"));
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
        return this.store.t9n.activeMessage;
    }

    get translations() {
        return this.message.translationsInCurrentLanguage;
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
        const data = await this.orm.call("t9n.translation", "create_and_format", [], 
            {
                body: this.state.suggestedTranslationText.trim(),
                source_id: this.store.t9n.activeMessage.id,
                lang_id: this.store.t9n.activeLanguage.id,
            },
        );
        console.log(data);
        this.store["t9n.translation"].insert(data);
        this.state.suggestedTranslationText = "";
    }
}
