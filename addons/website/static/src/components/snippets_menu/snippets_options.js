/** @odoo-module **/
import { registry } from "@web/core/registry";
import {
    SnippetOption,
    Box,
    LayoutColumn,
    SizingX,
    SnippetMove,
} from "@web_editor/components/snippets_menu/snippets_options";

import { empty } from "@web_editor/utils/dom";
import { xml } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
registry.category("snippets_options").add("ContainerWidth", {
    template: "website.ContainerWidth",
    selector: "section, .s_carousel .carousel-item, s_quotes_carousel .carousel-item",
    exclude: "[data-snippet] :not(.oe_structure) > [data-snippet]",
    target: "> .container, > .container-fluid, > .o_container_small",
});

registry.category("snippets_options").add("Website.Layout", {
    component: LayoutColumn,
    template: "website.LayoutColumn",
    selector: "section, section.s_carousel_wrapper .carousel-item",
    target: "> *:has(> .row), > .s_allow_columns",
    exclude: ".s_masonry_block, .s_features_grid, .s_media_list, .s_showcase, .s_table_of_content, .s_process_steps, .s_image_gallery",
});

patch(SnippetOption.prototype, {
    setup() {
        super.setup(...arguments);
        this._website = useService("website");
    },
    async select() {
        await super.select(...arguments);
        await this._refreshPublicWidgets();
    },
    _refreshPublicWidgets() {
        return new Promise((resolve, reject) => this._website.websiteRootInstance.trigger_up("widgets_start_request", {
            onSuccess: resolve,
            onFailure: reject,
        }));
    }
});

class Carousel extends SnippetOption {
    start() {
        let _slideTimestamp;
        this._slide = () => {
            _slideTimestamp = window.performance.now();
            setTimeout(() => this.props.toggleOverlay(false));
        };
        this._slid = () => {
            // slid.bs.carousel is most of the time fired too soon by bootstrap
            // since it emulates the transitionEnd with a setTimeout. We wait
            // here an extra 20% of the time before retargeting edition, which
            // should be enough...
            const _slideDuration = window.performance.now() - _slideTimestamp;
            setTimeout(() => {
                this.env.activateSnippet(this.target.querySelector(".carousel-item.active"));
                //this.$bsTarget.trigger("active_slide_targeted");
            }, 0.2 * _slideDuration);
        };
        const targetWindow = this.target.ownerDocument.defaultView;
        const carousel = targetWindow.Carousel.getOrCreateInstance(this.target);
        carousel.pause();
        this.target.addEventListener("slide.bs.carousel", this._slide);
        this.target.addEventListener("slid.bs.carousel", this._slid);
    }
    /**
     * Get the indicator parts of the target
     *
     * @returns {NodeList}
     */
    getIndicators() {
        return this.target.querySelectorAll(".carousel-indicators > *");
    }
    /**
     * @override
     */
    async cleanForSave() {
        this.target.removeEventListener("slide.bs.carousel", this._slide);
        this.target.removeEventListener("slid.bs.carousel", this._slid);
        const items = this.target.querySelectorAll(".carousel-item");
        items.forEach((el) => {
            el.classList.remove("next", "prev", "left", "right", "active");
        });
        items.item(0).classList.add("active");
        const indicators = this.getIndicators();
        indicators.forEach((indicatorEl) => {
            indicatorEl.classList.remove("active");
            empty(indicatorEl);
        });
        indicators.item(0).classList.add("active");
    }
    /**
     * @override
     */
    onBuilt() {
        this._assignUniqueID();
    }
    /**
     * @override
     */
    onClone() {
        this._assignUniqueID();
    }
    /**
     * @override
     */
    notify(name, data) {
        this._super(...arguments);
        if (name === "add_slide") {
            this._addSlide();
        }
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    addSlide(previewMode, widgetValue, params) {
        this._addSlide();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Creates a unique ID for the carousel and reassign data-attributes that
     * depend on it.
     *
     * @param {HTMLElement} target
     * @private
     */
    _assignUniqueID() {
        const id = "myCarousel" + Date.now();
        this.target.id = id;
        const bsTarget = this.target.querySelector("[data-bs-target]");
        if (bsTarget) {
            bsTarget.dataset.id = "#" + id;
        }
        this.target.querySelectorAll("[data-bs-slide], [data-bs-slide-to]").forEach((el) => {
            if (el.getAttribute("data-bs-target")) {
                el.dataset.bsTarget = "#" + id;
            } else if (el.getAttribute("href")) {
                el.setAttribute("href", "#" + id);
            }
        });
    }
    /**
     * Adds a slide.
     *
     * @param {HTMLElement} target
     * @private
     */
    _addSlide() {
        this.target
            .querySelectorAll("carousel-control-prev, .carousel-control-next, .carousel-indicators")
            .forEach((el) => {
                el.classList.remove("d-none");
            });
        const items = this.target.querySelectorAll(".carousel-item");
        const active = [...items].find((el) => el.classList.contains("active"));

        const indicators = this.getIndicators(target);
        const indicatorEl = document.createElement("li");
        indicatorEl.dataset.bsTarget = "#" + target.id;
        indicatorEl.dataset.bsSlideTo = items.length;
        indicators.item(0).parentElement.appendChild(indicatorEl);
        active.classList.remove("active");
        const newSlide = active.clone(true);
        active.parentElement.appendChild(newSlide);
    }
}
registry.category("snippets_options").add("Carousel", {
    template: "website.Carousel",
    component: Carousel,
    selector: "section",
    target: "* > .carousel",
});

registry.category("snippets_options").add("website.Box", {
    template: "website.Box",
    component: Box,
    selector: "section .row > div",
    exclude: ".s_col_no_bgcolor, .s_col_no_bgcolor.row > div, .s_image_gallery .row > div, .s_masonry_block .s_col_no_resize, .s_text_cover .row > .o_not_editable",
});

//registry.category("snippets_options").add("website.sizing_y", {
//    template: xml`<div class="d-none"/>`,
//
//}
//<div data-js="sizing_y"
//     data-selector="section, .row > div, .parallax, .s_hr, .carousel-item, .s_rating"
//     data-exclude="section:has(> .carousel), .s_image_gallery .carousel-item, .s_col_no_resize.row > div, .s_col_no_resize"/>

registry.category("snippets_options").add("website.sizing_x", {
    component: SizingX,
    template: xml`<div class="d-none"/>`,
    selector: ".row > div",
    dropNear: ".row:not(.s_col_no_resize) > div",
    exclude: ".s_col_no_resize.row > div, .s_col_no_resize",
});

//<div data-js="sizing_x"
//     data-selector=".row > div"
//     data-drop-near=".row:not(.s_col_no_resize) > div"
//     data-exclude=".s_col_no_resize.row > div, .s_col_no_resize"/>
//
//<div data-js="sizing_grid"
//     data-selector=".row > div"
//     data-drop-near=".row.o_grid_mode > div"
//     data-exclude=".s_col_no_resize.row > div, .s_col_no_resize"/>

registry.category("snippets_options").add("move_horizontally_opt", {
    template: "website.move_horizontally_opt",
    component: SnippetMove,
    selector: ".row:not(.s_col_no_resize) > div, .nav-item",
    exclude: ".s_showcase .row > div",
});
