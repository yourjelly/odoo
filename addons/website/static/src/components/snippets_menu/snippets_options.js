/** @odoo-module **/
import { registry } from "@web/core/registry";
import {
    SnippetOption,
    Box,
    LayoutColumn,
    SizingX,
    SnippetMove,
    ColoredLevelBackground,
    BackgroundToggler,
    VerticalAlignment,
    CarouselHandler,
} from "@web_editor/components/snippets_menu/snippets_options";

import {
    onRendered,
    useSubEnv,
    xml,
} from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import options from "@web_editor/js/editor/snippets.options";
import {_t} from "@web/core/l10n/translation";
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
            editableMode: true,
        }));
    }
});

class Carousel extends CarouselHandler {
    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [...this.env.validMethodNames, "addSlide"],
        });
    }

    start() {
        let _slideTimestamp;
        this.onSlide = () => {
            _slideTimestamp = window.performance.now();
            setTimeout(() => this.props.toggleOverlay(false));
        };
        this.onSlid = () => {
            // slid.bs.carousel is most of the time fired too soon by bootstrap
            // since it emulates the transitionEnd with a setTimeout. We wait
            // here an extra 20% of the time before retargeting edition, which
            // should be enough...
            const _slideDuration = window.performance.now() - _slideTimestamp;
            setTimeout(() => {
                this.env.activateSnippet(this.target.querySelector(".carousel-item.active"));
                this.target.dispatchEvent(new Event("active_slide_targeted"));
            }, 0.2 * _slideDuration);
        };
        this.bsCarousel.pause();
        this.target.addEventListener("slide.bs.carousel", this.onSlide);
        this.target.addEventListener("slid.bs.carousel", this.onSlid);
    }
    /**
     * @override
     */
    async cleanForSave() {
        this.target.removeEventListener("slide.bs.carousel", this.onSlide);
        this.target.removeEventListener("slid.bs.carousel", this.onSlid);
        const items = this.getGalleryItems();
        items.forEach((el) => {
            el.classList.remove("next", "prev", "left", "right", "active");
        });
        items[0].classList.add("active");
        this.indicatorsEls.forEach((indicatorEl) => {
            indicatorEl.classList.remove("active");
            indicatorEl.replaceChildren();
        });
        this.indicatorsEls.item(0).classList.add("active");
    }
    /**
     * @override
     */
    onBuilt() {
        this.assignUniqueID();
    }
    /**
     * @override
     */
    onClone() {
        this.assignUniqueID();
    }
    /**
     * @override
     */
    async notify(name, data) {
        await super.notify(...arguments);
        if (name === "add_slide") {
            this.addSlide();
        }
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Adds a slide.
     *
     * @see this.selectClass for parameters
     */
    addSlide(previewMode, widgetValue, params) {
        this.target
            .querySelectorAll("carousel-control-prev, .carousel-control-next, .carousel-indicators")
            .forEach((el) => {
                el.classList.remove("d-none");
            });
        const items = this.getGalleryItems();
        const active = items.find((el) => el.classList.contains("active"));

        const indicatorEl = document.createElement("li");
        indicatorEl.dataset.bsTarget = "#" + this.target.id;
        indicatorEl.dataset.bsSlideTo = items.length;
        this.indicatorsEls.item(0).parentElement.appendChild(indicatorEl);
        const newSlide = active.cloneNode(true);
        newSlide.classList.remove("active");
        active.parentElement.insertBefore(newSlide, active.nextSibling);
        this.bsCarousel.next();
    }

    //--------------------------------------------------------------------------
    // Internal
    //--------------------------------------------------------------------------

    /**
     * Creates a unique ID for the carousel and reassign data-attributes that
     * depend on it.
     */
    assignUniqueID() {
        const id = "myCarousel" + Date.now();
        this.target.id = id;
        const bsTarget = this.target.querySelector("[data-bs-target]");
        if (bsTarget) {
            bsTarget.dataset.bsTarget = "#" + id;
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
     * Gets the indicator parts of the carousel.
     *
     * @returns {NodeList}
     */
    get indicatorsEls() {
        return this.target.querySelectorAll(".carousel-indicators > *");
    }
    /**
     * @override
     */
    getGalleryItems() {
        return Array.from(this.target.querySelectorAll(".carousel-item"));
    }
    /**
     * @override
     */
    reorderItems(itemsEls, newItemPosition) {
        const carouselInnerEl = this.target.querySelector(".carousel-inner");
        // First, empty the content of the carousel.
        carouselInnerEl.replaceChildren();
        // Then fill it with the new slides.
        for (const itemsEl of itemsEls) {
            carouselInnerEl.append(itemsEl);
        }
        this.updateIndicatorAndActivateSnippet(newItemPosition);
    }
}
registry.category("snippets_options").add("Carousel", {
    template: "website.Carousel",
    component: Carousel,
    selector: "section",
    target: "> .carousel",
});

class CarouselItem extends SnippetOption {
    static isTopOption = true;
    static forceNoDeleteButton = true;

    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [...this.env.validMethodNames, "addSlideItem", "removeSlide", "switchToSlide"],
        });

        onRendered(() => {
            this.carouselEl = this.target.closest(".carousel");
        });
    }

    /**
     * @override
     */
    start() {
        // TODO: option title patch
        // const leftPanelEl = this.$overlay.data('$optionsSection')[0];
        // const titleTextEl = leftPanelEl.querySelector('we-title > span');
        // this.counterEl = document.createElement('span');
        // titleTextEl.appendChild(this.counterEl);

        return super.start(...arguments);
    }
    /**
     * Updates the slide counter.
     *
     * @override
     */
    async updateUI() {
        await super.updateUI(...arguments);
        const items = this.target.parentElement.children;
        const activeSlide = [...items].find((el) => el.classList.contains("active"));
        const updatedText = ` (${items.indexOf(activeSlide) + 1} / ${items.length})`;
        this.counterEl.textContent = updatedText;
    }
    /**
     * @override
     */
    async cleanForSave() {
        this.carouselEl.removeEventListener("active_slide_targeted", this.onActiveSlideTargeted);
        await super.cleanForSave()
    }
    /**
     * Gets the bootstrap instance of the carousel.
     */
    get bsCarousel() {
        const targetWindow = this.target.ownerDocument.defaultView;
        return targetWindow.Carousel.getOrCreateInstance(this.carouselEl);
    }
    /**
     * Gets the indicator parts of the carousel.
     *
     * @returns {NodeList}
     */
    get indicatorsEls() {
        return this.carouselEl.querySelectorAll(".carousel-indicators > *");
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    async addSlideItem(previewMode, widgetValue, params) {
        await this.props.notifyOptions("Carousel", {
            name: "add_slide",
        });
    }
    /**
     * Removes the current slide.
     *
     * @see this.selectClass for parameters.
     */
    removeSlide(previewMode) {
        const items = this.target.parentElement.children;
        const newLength = items.length - 1;

        if (!this.removing && newLength > 0) {
            // The active indicator is deleted to ensure that the other
            // indicators will still work after the deletion.
            const toDelete = [
                [...items].find((item) => item.classList.contains("active")),
                [...this.indicatorsEls].find(indicator => indicator.classList.contains("active")),
            ];
            this.onActiveSlideTargeted = () => {
                toDelete.forEach((el) => el.remove());
                // To ensure the proper functioning of the indicators, their
                // attributes must reflect the position of the slides.
                for (let i = 0; i < this.indicatorsEls.length; i++) {
                    this.indicatorsEls[i].setAttribute("data-bs-slide-to", i);
                }
                const controlsEls = this.carouselEl.querySelectorAll(
                    "carousel-control-prev, .carousel-control-next, .carousel-indicators");
                controlsEls.forEach((el) => el.classList.toggle("d-none", newLength === 1));
                this.carouselEl.dispatchEvent(new Event("content_changed")); // For what?
                // this.$carousel.trigger('content_changed');
                this.removing = false;
            };

            this.carouselEl.addEventListener("active_slide_targeted", this.onActiveSlideTargeted, { once: true });
            this.removing = true;
            this.bsCarousel.prev();
        }
    }
    /**
     * Goes to next slide or previous slide.
     *
     * @see this.selectClass for parameters
     */
    switchToSlide(previewMode, widgetValue, params) {
        switch (widgetValue) {
            case 'left':
                this.bsCarousel.prev();
                break;
            case 'right':
                this.bsCarousel.next();
                break;
        }
    }
}
registry.category("snippets_options").add("CarouselItem", {
    template: "website.CarouselItem",
    component: CarouselItem,
    selector: ".s_carousel .carousel-item, .s_quotes_carousel .carousel-item",
});

class GalleryElement extends SnippetOption {
    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [...this.env.validMethodNames, "position"],
        });
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Allows to change the position of an item on the set.
     *
     * @see this.selectClass for parameters
     */
    async position(previewMode, widgetValue, params) {
        const optionName = this.target.classList.contains("carousel-item") ? "Carousel"
            : "GalleryImageList";
        await this.props.notifyOptions(optionName, {
            name: "reorder_items",
            data: {
                itemEl: this.target,
                position: widgetValue,
            },
        });
        // TODO: notify
        // this.trigger_up("option_update", {
        //     optionName: optionName,
        //     name: "reorder_items",
        //     data: {
        //         itemEl: this.target,
        //         position: widgetValue,
        //     },
        // });
    }
}
registry.category("snippets_options").add("GalleryElement", {
    template: "website.GalleryElement",
    component: GalleryElement,
    selector: ".s_image_gallery img, .s_carousel .carousel-item",
}, {
    sequence: 1,
});

registry.category("snippets_options").add("website.Box", {
    template: "website.Box",
    component: Box,
    selector: "section .row > div",
    exclude: ".s_col_no_bgcolor, .s_col_no_bgcolor.row > div, .s_image_gallery .row > div, .s_masonry_block .s_col_no_resize, .s_text_cover .row > .o_not_editable",
});
registry.category("snippets_options").add("website.CardBox", {
    template: "website.CardBox",
    component: Box,
    selector: ".s_three_columns .row > div, .s_comparisons .row > div",
    target: ".card",
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

registry.category("snippets_options").add("VerticalAlignment", {
    component: VerticalAlignment,
    template: "website.VerticalAlignment",
    selector: ".s_text_image, .s_image_text, .s_three_columns",
    target: ".row",
});
/**
 * Background snippet options
 */
const baseOnlyBgImage = {
    selector: ".s_tabs .oe_structure > *, footer .oe_structure > *"
}
const bgSelectors = {
    onlyBgColor: {
        selector: "section .row > div, .s_text_highlight, .s_mega_menu_thumbnails_footer",
        exclude: ".s_col_no_bgcolor, .s_col_no_bgcolor.row > div, .s_masonry_block .row > div, .s_color_blocks_2 .row > div, .s_image_gallery .row > div, .s_text_cover .row > .o_not_editable",
        withImages: false,
        withColors: true,
        withColorCombinations: true,
        withGradients: true,
    },
    onlyBgImage: {
        selector: baseOnlyBgImage.selector,
        exclude: "",
        withVideos: true,
        withImages: true,
        withColors: false,
        withShapes: true,
        withColorCombinations: false,
        withGradients: true,
    }
}

function registerBackgroundOption(name, params) {
    const option = {};
    if (params.withColors && params.withColorCombinations) {
        option.component = ColoredLevelBackground;
    } else {
        option.component = BackgroundToggler;
    }
    option.template = "web_editor.ColoredLevelBackground";
    Object.assign(option, params);
    registry.category("snippets_options").add(name, option);
}

registerBackgroundOption("bothBgColorImage", {
    selector: "section, .carousel-item, .s_masonry_block .row > div, .s_color_blocks_2 .row > div, .parallax, .s_text_cover .row > .o_not_editable",
    exclude: baseOnlyBgImage.selector + ", .s_carousel_wrapper, .s_image_gallery .carousel-item, .s_google_map, .s_map, [data-snippet] :not(.oe_structure) > [data-snippet], .s_masonry_block .s_col_no_resize",
    withVideos: true,
    withImages: true,
    withColors: true,
    withShapes: true,
    withColorCombinations: true,
    withGradients: true,
});


class ScrollButton extends SnippetOption {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.env.validMethodNames.push("toggleButton", "showScrollButton");
    }
    /**
     * @override
     */
    async start() {
        await super.start(...arguments);
        this.$button = this.$('.o_scroll_button');
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    async showScrollButton(previewMode, widgetValue, params) {
        if (widgetValue) {
            this.$button.show();
        } else {
            if (previewMode) {
                this.$button.hide();
            } else {
                this.$button.detach();
            }
        }
    }
    /**
     * Toggles the scroll down button.
     */
    toggleButton(previewMode, widgetValue, params) {
        if (widgetValue) {
            if (!this.$button.length) {
                const anchor = document.createElement('a');
                anchor.classList.add(
                    'o_scroll_button',
                    'mb-3',
                    'rounded-circle',
                    'align-items-center',
                    'justify-content-center',
                    'mx-auto',
                    'bg-primary',
                    'o_not_editable',
                );
                anchor.href = '#';
                anchor.contentEditable = "false";
                anchor.title = _t("Scroll down to next section");
                const arrow = document.createElement('i');
                arrow.classList.add('fa', 'fa-angle-down', 'fa-3x');
                anchor.appendChild(arrow);
                this.$button = $(anchor);
            }
            this.$target.append(this.$button);
        } else {
            this.$button.detach();
        }
    }
    /**
     * @override
     */
    async selectClass(previewMode, widgetValue, params) {
        await super.selectClass(...arguments);
        // If a "d-lg-block" class exists on the section (e.g., for mobile
        // visibility option), it should be replaced with a "d-lg-flex" class.
        // This ensures that the section has the "display: flex" property
        // applied, which is the default rule for both "height" option classes.
        if (params.possibleValues.includes("o_half_screen_height")) {
            if (widgetValue) {
                this.$target[0].classList.replace("d-lg-block", "d-lg-flex");
            } else if (this.$target[0].classList.contains("d-lg-flex")) {
                // There are no known cases, but we still make sure that the
                // <section> element doesn't have a "display: flex" originally.
                this.$target[0].classList.remove("d-lg-flex");
                const sectionStyle = window.getComputedStyle(this.$target[0]);
                const hasDisplayFlex = sectionStyle.getPropertyValue("display") === "flex";
                this.$target[0].classList.add(hasDisplayFlex ? "d-lg-flex" : "d-lg-block");
            }
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'toggleButton':
                return !!this.$button.parent().length;
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @override
     */
    computeWidgetVisibility(widgetName, params) {
        if (widgetName === 'fixed_height_opt') {
            return (this.$target[0].dataset.snippet === 's_image_gallery');
        }
        return super.computeWidgetVisibility(...arguments);
    }
}
registry.category("snippets_options").add("website.ScrollButton", {
    component: ScrollButton,
    template: "website.ScrollButton",
    selector: "section",
    exclude: "[data-snippet] :not(.oe_structure) > [data-snippet]",
})
