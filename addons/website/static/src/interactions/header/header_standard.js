import { BaseHeader } from "./base_header";
import { registry } from "@web/core/registry";

class HeaderStandard extends BaseHeader {
    static selector = "header.o_header_standard:not(.o_header_sidebar)";

    setup() {
        super.setup();
        this.isFixed = false;
        this.isAnimated = true;

        this.scrolledPoint = 300;
    }

    destroy() {
        super.destroy();
        this.el.css.transform = "";
    }

    onScroll() {
        super.onScroll();

        const scroll = document.scrollingElement.scrollTop;

        const mainPosScrolled = (scroll > this.el.getBoundingClientRect().height);
        const reachPosScrolled = (scroll > this.scrolledPoint) && !this.triggerScrollChange;
        const isFixedUpdate = (this.isFixed !== mainPosScrolled);
        const isFixedShownUpdate = (this.isFixedShown !== reachPosScrolled);

        if (isFixedUpdate || isFixedShownUpdate) {
            this.el.style.transform = reachPosScrolled
                ? `translate(0, 0)`
                : mainPosScrolled
                    ? 'translate(0, -100%)'
                    : '';
            void this.el.offsetWidth; // Force a paint refresh
        }

        this.isHidden = !reachPosScrolled;
        this.hiddenOnScrollEl?.classList.toggle("hidden", mainPosScrolled);

        if (isFixedUpdate) {
            this.toggleFixedBehavior(mainPosScrolled);
        } else if (isFixedShownUpdate) {
            this.adaptToHeaderChange();
        }
    }
}

registry
    .category("website.active_elements")
    .add("website.header_standard", HeaderStandard);
