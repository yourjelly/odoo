import { BaseHeaderSpecial } from "./base_header_special";
import { registry } from "@web/core/registry";

class HeaderFixed extends BaseHeaderSpecial {
    static selector = "header.o_header_fixed:not(.o_header_sidebar)";

    setup() {
        super.setup();

        this.isFixed = true;
        this.isAnimated = false;
    }
}

registry
    .category("website.active_elements")
    .add("website.header_fixed", HeaderFixed);
