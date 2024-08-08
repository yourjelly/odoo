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

        useEffect(
            () => {
                if (this.store.emoji_picker_mobile?.props) {
                    this.props = this.store.emoji_picker_mobile.props;
                }
                if (this.store.emoji_picker_mobile.isVisible) {
                    setTimeout(() => {
                        this.bgElement = document.getElementsByClassName("o_form_view")[0];
                        if (this.bgElement) {
                            if (this.bgElement.scrollHeight > this.bgElement.clientHeight) {
                                console.log("it has scrollable height");
                                this.setScrollTopInVh(this.bgElement, 55);
                            }
                        }
                    }, 0);
                }
            },
            () => [this.store.emoji_picker_mobile.isVisible]
        );
    }
    setScrollTopInVh(element, vhUnits) {
        const vh = window.innerHeight; // Get the viewport height in pixels
        const scrollValue = vh * (vhUnits / 100); // Convert vh units to pixels
        element.scrollTop += scrollValue; // Adjust scrollTop
    }
}

registry.category("main_components").add("web.EmojiPickerMobile", { Component: EmojiPickerMobile });
