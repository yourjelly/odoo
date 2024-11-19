import { BaseHeaderSpecial } from "./base_header_special";
import { registry } from "@web/core/registry";

class HeaderFadeOut extends BaseHeaderSpecial {
    static selector = "header.o_header_fade_out:not(.o_header_sidebar)";

    setup() {
        super.setup();

        this.isFixed = false;
        this.isAnimated = true;
    }

    adjustURLAutoScroll() { }

    showHeader() {
        super.showHeader();
        this.el.style.transform = this.currentPosition <= 0 ? "" : `translate(0, 0)`;
        this.el.style.display = '';
        this.el.style.opacity = '0';
        this.el.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { this.el.style.opacity = '1'; }, 10);
    }

    hideHeader() {
        super.hideHeader();
        this.el.style.transition = 'opacity 0.4s ease';
        this.el.style.opacity = '0';
        setTimeout(() => { this.el.style.display = 'none'; }, 400);
    }
}

registry
    .category("website.active_elements")
    .add("website.header_fade_out", HeaderFadeOut);
