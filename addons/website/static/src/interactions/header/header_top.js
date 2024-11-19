import { Interaction } from "@website/core/interaction";
import { registry } from "@web/core/registry";

// TODO
class HeaderTop extends Interaction {
    static selector = "header#top";
    dynamicContent = {
        "#top_menu_collapse, #top_menu_collapse_mobile": {
            "t-on-show.bs.offcanvas": this.onCollapseShow,
            "t-on-hidden.bs.offcanvas": this.onCollapseHidden,
        },
    }

    onCollapseShow() {
        // this.options.wysiwyg?.odooEditor.observerUnactive("addCollapseClass");
        this.el.classList.add('o_top_menu_collapse_shown');
        // this.options.wysiwyg?.odooEditor.observerActive("addCollapseClass");
    }

    onCollapseHidden() {
        // this.options.wysiwyg?.odooEditor.observerUnactive("removeCollapseClass");
        const mobileNavbarEl = this.el.querySelector("#top_menu_collapse_mobile");
        if (!mobileNavbarEl.matches(".show, .showing")) {
            this.el.classList.remove("o_top_menu_collapse_shown");
        }
        // this.options.wysiwyg?.odooEditor.observerActive("removeCollapseClass");
    }
}

registry
    .category("website.active_elements")
    .add("website.header_top", HeaderTop);
