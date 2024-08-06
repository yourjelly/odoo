import { registry } from "@web/core/registry";
import { EmojiPicker } from "./emoji_picker";
import { useService } from "../utils/hooks";
import { useEffect, useState } from "@odoo/owl";
import { onExternalClick } from "@mail/utils/common/hooks";

export class EmojiPickerMobile extends EmojiPicker {
    static template = "web.EmojiPickerMobile";
    setup() {
        super.setup();
        this.store = useState(useService("mail.store"));
        onExternalClick("emojipickermobile", (ev) => {
            ev.stopPropagation();
            this.store.emoji_picker_mobile.isVisible = false;
            console.log("made it false");
        });
        useEffect(() => {
            console.log(this.store.emoji_picker_mobile.isVisible);
            if (this.store.emoji_picker_mobile?.props) {
                this.props = this.store.emoji_picker_mobile.props;
            }
        });
    }
}

registry.category("main_components").add("web.EmojiPickerMobile", { Component: EmojiPickerMobile });
