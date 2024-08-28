import { registry } from "@web/core/registry";
import { EmojiPicker } from "./emoji_picker";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";

export function onExternalClick(refName, cb) {
    let downTarget, upTarget;
    const ref = useRef(refName);
    function onClick(ev) {
        if (ref.el && !ref.el.contains(ev.target)) {
            cb(ev, { downTarget, upTarget });
            upTarget = downTarget = null;
        }
    }
    function onMousedown(ev) {
        downTarget = ev.target;
    }
    function onMouseup(ev) {
        upTarget = ev.target;
    }
    onMounted(() => {
        document.body.addEventListener("mousedown", onMousedown, true);
        document.body.addEventListener("mouseup", onMouseup, true);
        document.body.addEventListener("click", onClick, true);
    });
    onWillUnmount(() => {
        document.body.removeEventListener("mousedown", onMousedown, true);
        document.body.removeEventListener("mouseup", onMouseup, true);
        document.body.removeEventListener("click", onClick, true);
    });
}

export class EmojiPickerMobile extends EmojiPicker {
    static template = "web.EmojiPickerMobile";
    setup() {
        super.setup();
        this.store = useState(useService("mail.store"));
        onExternalClick("emojipickermobile", (ev) => {
            ev.stopPropagation();
            this.store.emoji_picker_mobile.isVisible = false;
        });

        useEffect(
            () => {
                if (this.store.emoji_picker_mobile?.props) {
                    this.props = this.store.emoji_picker_mobile.props;
                }
            },
            () => [this.store.emoji_picker_mobile.isVisible]
        );
    }
}

registry.category("main_components").add("web.EmojiPickerMobile", { Component: EmojiPickerMobile });
