import { Interaction } from "@website/core/interaction";
import { registry } from "@web/core/registry";

import { rpc } from "@web/core/network/rpc";

class WebsiteControllerPageListingLayout extends Interaction {
    static selector = ".o_website_listing_layout";
    dynamicContent = {
        ".listing_layout_switcher input": {
            "t-on-change": this.onChange,
        },
    }

    /**
     * @param {Event} ev
     */
    onChange(ev) {
        // this.options.wysiwyg?.odooEditor.observerUnactive("onChange");
        const clickedValue = ev.target.value;
        const isList = clickedValue === "list";
        if (!this.editableMode) {
            rpc("/website/save_session_layout_mode", {
                layout_mode: isList ? "list" : "grid",
                view_id: document
                    .querySelector(".listing_layout_switcher")
                    .getAttribute("data-view-id"),
            });
        }

        const activeClasses = ev.target.parentElement.dataset.activeClasses.split(" ");
        ev.target.parentElement.querySelectorAll(".btn").forEach((btn) => {
            activeClasses.map((c) => btn.classList.toggle(c));
        });

        const el = document.querySelector(isList ? ".o_website_grid" : ".o_website_list");
        if (el) {
            el.classList.toggle("o_website_list", isList);
            el.classList.toggle("o_website_grid", !isList);
            const classList = isList ? "" : "col-lg-3 col-md-4 col-sm-6 px-2 col-xs-12";
            // each card must have the correct bootstrap classes
            [...document.querySelectorAll(".o_website_list > div, .o_website_grid > div")].forEach((card) => {
                card.classList = classList;
            });
        }
        // this.options.wysiwyg?.odooEditor.observerActive("onChange");
    }
}

registry
    .category("website.active_elements")
    .add("website.website_controller_page_listing_layout", WebsiteControllerPageListingLayout);
