import { BaseHeaderSpecial } from "./base_header_special";
import { registry } from "@web/core/registry";

class HeaderDisappearing extends BaseHeaderSpecial {
    static selector = "header.o_header_disappears:not(.o_header_sidebar)";

    setup() {
        super.setup();

        this.isFixed = false;
        this.isAnimated = true;
    }

    adjustURLAutoScroll() { }

    showHeader() {
        super.showHeader();
        this.el.style.transform = this.currentPosition <= 0 ? "" : "translate(0, 0)";
    }

    hideHeader() {
        super.hideHeader();
        this.el.style.transform = "translate(0, -100%)";
    }
}

registry
    .category("website.active_elements")
    .add("website.header_disappearing", HeaderDisappearing);
