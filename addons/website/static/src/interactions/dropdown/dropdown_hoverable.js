import { Interaction } from "@website/core/interaction";
import { registry } from "@web/core/registry";

import { SIZES, utils as uiUtils } from "@web/core/ui/ui_service";

class DropdownHoverable extends Interaction {
    static selector = "header.o_hoverable_dropdown";
    dynamicContent = {
        ".dropdown": {
            "t-on-mouseenter": this.onMouseEnter,
            "t-on-mouseleave": this.onMouseLeave,
        },
        _window: {
            "t-on-resize": this.onResize,
        },
    };

    setup() {
        this.dropdownMenus = this.el.querySelectorAll(".dropdown-menu");
        this.dropdownToggles = this.el.querySelectorAll(".dropdown-toggle");
    }

    start() {
        this.onResize();
    }

    /**
     * @param {Event} ev
     * @param {boolean} show
     */
    updateDropdownVisibility(ev, show) {
        const dropdownToggleEl = ev.currentTarget.querySelector(".dropdown-toggle");
        if (
            !dropdownToggleEl
            || uiUtils.getSize() < SIZES.LG
            || ev.currentTarget.closest(".o_extra_menu_items")
        ) {
            return;
        }
        const dropdown = Dropdown.getOrCreateInstance(dropdownToggleEl);
        show ? dropdown.show() : dropdown.hide();
    }

    /**
     * @param {Event} ev
     */
    onMouseEnter(ev) {
        if (
            this.editableMode
            || this.el.querySelector(".dropdown-toggle.show")
        ) {
            return;
        }
        const focusedEl = this.el.ownerDocument.querySelector(":focus")
            || window.frameElement?.ownerDocument.querySelector(":focus");

        // The user must click on the dropdown if he is on mobile (no way to
        // hover) or if the dropdown is the (or in the) extra menu ('+').
        this.updateDropdownVisibility(ev, true);

        // Keep the focus on the previously focused element if any, otherwise do
        // not focus the dropdown on hover.
        if (focusedEl) {
            focusedEl.focus({ preventScroll: true });
        } else {
            const dropdownToggleEl = ev.currentTarget.querySelector(".dropdown-toggle");
            if (dropdownToggleEl) {
                dropdownToggleEl.blur();
            }
        }
    }

    /**
     * @param {Event} ev
     */
    onMouseLeave(ev) {
        if (this.editableMode) {
            return;
        }
        this.updateDropdownVisibility(ev, false);
    }

    onResize() {
        if (uiUtils.getSize() < SIZES.LG) {
            for (const dropdownMenu of this.dropdownMenus) {
                dropdownMenu.setAttribute("data-bs-popper", "none");
                dropdownMenu.setAttribute("margin-top", "");
                dropdownMenu.setAttribute("top", "");
            }
        } else {
            for (const dropdownMenu of this.dropdownMenus) {
                dropdownMenu.setAttribute("data-bs-popper", "none");
                dropdownMenu.setAttribute("margin-top", "0");
                dropdownMenu.setAttribute("top", "unset");
            }
        }
    }
}

registry
    .category("website.active_elements")
    .add("website.dropdown_hoverable", DropdownHoverable);
