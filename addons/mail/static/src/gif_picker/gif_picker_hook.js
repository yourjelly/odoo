/* @odoo-module */

import { usePopover } from "@web/core/popover/popover_hook";
import { GifPicker } from "./gif_picker";

/**
 * @param {{el: HTMLElement}} ref
 * @param {import('@mail/core/thread_model').Thread} thread
 */
export function useGifPicker(ref, thread) {
    let closePopover;
    const popover = usePopover(GifPicker, {
        position: "top",
        popoverClass: "o-fast-popover",
        onClose: () => (closePopover = undefined),
    });
    function toggle() {
        if (closePopover) {
            closePopover();
            closePopover = undefined;
        } else {
            closePopover = popover.open(ref.el, { thread });
        }
    }
    return { toggle };
}
