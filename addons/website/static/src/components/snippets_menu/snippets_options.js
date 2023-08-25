/** @odoo-module **/
import { registry } from "@web/core/registry";
import { session } from "@web/session";
import {
    SnippetOption,
    Box,
    LayoutColumn,
    Sizing,
    SizingX,
    SizingY,
    SizingGrid,
    SnippetMove,
    ColoredLevelBackground,
    BackgroundToggler,
    VerticalAlignment,
    CarouselHandler,
} from "@web_editor/components/snippets_menu/snippets_options";

import {
    onMounted,
    onRendered,
    onWillStart,
    useState,
    useSubEnv,
    xml,
} from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
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
            $target: this.$target,
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
        await super.cleanForSave();
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

patch(Sizing.prototype, {
    /**
     * @override
     */
    start() {
        const defs = super.start(...arguments);
        const self = this;
        this.$handles.on("mousedown", function (ev) {
            // Since website is edited in an iframe, a div that goes over the
            // iframe is necessary to catch mousemove and mouseup events,
            // otherwise the iframe absorbs them.
            const $body = $(this.ownerDocument.body);
            if (!self.divEl) {
                self.divEl = document.createElement("div");
                self.divEl.style.position = "absolute";
                self.divEl.style.height = "100%";
                self.divEl.style.width = "100%";
                self.divEl.setAttribute("id", "iframeEventOverlay");
                $body.append(self.divEl);
            }
            const documentMouseUp = () => {
                // Multiple mouseup can occur if mouse goes out of the window
                // while moving.
                if (self.divEl) {
                    self.divEl.remove();
                    self.divEl = undefined;
                }
                $body.off("mouseup", documentMouseUp);
            };
            $body.on("mouseup", documentMouseUp);
        });
        return defs;
    },
    /**
     * @override
     */
    async updateUIVisibility() {
        await super.updateUIVisibility(...arguments);
        const nonDraggableClasses = [
            "s_table_of_content_navbar_wrap",
            "s_table_of_content_main",
        ];
        if (nonDraggableClasses.some(c => this.target.classList.contains(c))) {
            const moveHandleEl = this.$overlay[0].querySelector(".o_move_handle");
            moveHandleEl.classList.add("d-none");
        }
    },
});

registry.category("snippets_options").add("website.sizing_y", {
    component: SizingY,
    template: xml`<div class="d-none"/>`,
    selector: "section, .row > div, .parallax, .s_hr, .carousel-item, .s_rating",
    exclude: "section:has(> .carousel), .s_image_gallery .carousel-item, .s_col_no_resize.row > div, .s_col_no_resize",
});

registry.category("snippets_options").add("website.sizing_x", {
    component: SizingX,
    template: xml`<div class="d-none"/>`,
    selector: ".row > div",
    dropNear: ".row:not(.s_col_no_resize) > div",
    exclude: ".s_col_no_resize.row > div, .s_col_no_resize",
});

registry.category("snippets_options").add("website.sizing_grid", {
    component: SizingGrid,
    template: xml`<div class="d-none"/>`,
    selector: ".row > div",
    dropNear: ".row.o_grid_mode > div",
    exclude: ".s_col_no_resize.row > div, .s_col_no_resize",
});

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

/**
 * Manage the visibility of snippets on mobile/desktop.
 */
class DeviceVisibility extends SnippetOption {
    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [...this.env.validMethodNames, "toggleDeviceVisibility"],
        });
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Toggles the device visibility.
     *
     * @see this.selectClass for parameters
     */
    async toggleDeviceVisibility(previewMode, widgetValue, params) {
        this.target.classList.remove('d-none', 'd-md-none', 'd-lg-none',
            'o_snippet_mobile_invisible', 'o_snippet_desktop_invisible',
            'o_snippet_override_invisible',
        );
        const style = getComputedStyle(this.target);
        this.target.classList.remove(`d-md-${style['display']}`, `d-lg-${style['display']}`);

        if (widgetValue === 'no_desktop') {
            this.target.classList.add('d-lg-none', 'o_snippet_desktop_invisible');
        } else if (widgetValue === 'no_mobile') {
            this.target.classList.add(`d-lg-${style['display']}`, 'd-none', 'o_snippet_mobile_invisible');
        }

        // Update invisible elements.
        const isMobile = this._website.context.isMobile;
        const show = widgetValue !== (isMobile ? 'no_mobile' : 'no_desktop');
        this.props.toggleSnippetOptionVisibility(show);
    }
    /**
     * @override
     */
    async onTargetHide() {
        this.target.classList.remove('o_snippet_override_invisible');
    }
    /**
     * @override
     */
    async onTargetShow() {
        if (this.target.classList.contains('o_snippet_mobile_invisible')
                || this.target.classList.contains('o_snippet_desktop_invisible')) {
            this.target.classList.add('o_snippet_override_invisible');
        }
    }
    /**
     * @override
     */
    cleanForSave() {
        this.target.classList.remove('o_snippet_override_invisible');
    }
    /**
     * @override
     */
    async computeWidgetState(methodName, params) {
        if (methodName === 'toggleDeviceVisibility') {
            const classList = [...this.target.classList];
            if (classList.includes('d-none') &&
                    classList.some(className => className.match(/^d-(md|lg)-/))) {
                return 'no_mobile';
            }
            if (classList.some(className => className.match(/d-(md|lg)-none/))) {
                return 'no_desktop';
            }
            return '';
        }
        return await super.computeWidgetState(...arguments);
    }
    /**
     * @override
     */
    computeWidgetVisibility(widgetName, params) {
        if (this.target.classList.contains('s_table_of_content_main')) {
            return false;
        }
        return super.computeWidgetVisibility(...arguments);
    }
    /**
     * @override
     */
    async computeVisibility() {
        return await super.computeVisibility(...arguments) &&
            !this.target.classList.contains('s_website_form_field_hidden');
    }
}
registry.category("snippets_options").add("DeviceVisibility", {
    component: DeviceVisibility,
    template: "website.DeviceVisibility",
    selector: "section .row > div",
});

class ConditionalVisibility extends DeviceVisibility {
    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [...this.env.validMethodNames, "selectRecord", "selectValue"],
        });
        this.orm = useService("orm");
        this.optionsAttributes = [];
        this.state = useState({
            geoipCountryCode: undefined,
            websiteLanguageIds: [],
        });

        onWillStart(async () => {
            const websiteLanguageIds = (await this.orm.read(
                "website",
                [this._website.currentWebsite.id],
                ["language_ids"],
            ))[0].language_ids;
            this.state.websiteLanguageIds = Object.values(websiteLanguageIds);
            this.state.geoipCountryCode = session.geoip_country_code;
        });

        onMounted(() => {
            for (const widget of Object.values(this.widgets)) {
                const params = widget.params;
                if (params.saveAttribute) {
                    this.optionsAttributes.push({
                        saveAttribute: params.saveAttribute,
                        attributeName: params.attributeName,
                        // If callWith dataAttribute is not specified, the default
                        // field to check on the record will be .value for values
                        // coming from another widget than M2M.
                        callWith: params.callWith || 'value',
                        // TODO OWL: remove this once WeMany2Many is fully
                        // implemented
                        model: params.m2oModel,
                    });
                }
            }
        });
    }
    /**
     * @override
     */
    async onTargetHide() {
        await super.onTargetHide(...arguments);
        if (this.target.classList.contains('o_snippet_invisible')) {
            this.target.classList.add('o_conditional_hidden');
        }
    }
    /**
     * @override
     */
    async onTargetShow() {
        await super.onTargetShow(...arguments);
        this.target.classList.remove('o_conditional_hidden');
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Inserts or deletes record's id and value in target's data-attributes
     * if no ids are selected, deletes the attribute.
     *
     * @see this.selectClass for parameters
     */
    async selectRecord(previewMode, widgetValue, params) {
        const recordsData = JSON.parse(widgetValue);
        if (recordsData.length) {
            this.target.dataset[params.saveAttribute] = widgetValue;
        } else {
            delete this.target.dataset[params.saveAttribute];
        }

        await this.updateCSSSelectors();
    }
    /**
     * Selects a value for target's data-attributes.
     * Should be used instead of selectRecord if the visibility is not related
     * to database values.
     *
     * @see this.selectClass for parameters
     */
    selectValue(previewMode, widgetValue, params) {
        if (widgetValue) {
            const widgetValueIndex = params.possibleValues.indexOf(widgetValue);
            const value = [{value: widgetValue, id: widgetValueIndex}];
            this.target.dataset[params.saveAttribute] = JSON.stringify(value);
        } else {
            delete this.target.dataset[params.saveAttribute];
        }

        this.updateCSSSelectors();
    }
    /**
     * Opens the toggler when 'conditional' is selected.
     *
     * @override
     */
    async selectDataAttribute(previewMode, widgetValue, params) {
        await super.selectDataAttribute(...arguments);

        if (params.attributeName === "visibility") {
            if (widgetValue === "conditional") {
                // TODO OWL: pass this as a prop to WeCollapse.
        //         const collapseEl = this.$el.children('we-collapse')[0];
        //         this._toggleCollapseEl(collapseEl);
            } else {
                // TODO create a param to allow doing this automatically for genericSelectDataAttribute?
                delete this.target.dataset.visibility;

                for (const attribute of this.optionsAttributes) {
                    delete this.target.dataset[attribute.saveAttribute];
                    delete this.target.dataset[`${attribute.saveAttribute}Rule`];
                }
            }
        } else if (!params.isVisibilityCondition) {
            return;
        }

        await this.updateCSSSelectors();
    }
    /**
     * @override
     */
    selectClass(previewMode, widgetValue, params) {
        super.selectClass(...arguments);
        this.props.toggleSnippetOptionVisibility(true);
    }

    //--------------------------------------------------------------------------
    // Internal
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async computeWidgetState(methodName, params) {
        if (methodName === 'selectRecord') {
            return this.target.dataset[params.saveAttribute] || '[]';
        }
        if (methodName === 'selectValue') {
            const selectedValue = this.target.dataset[params.saveAttribute];
            return selectedValue ? JSON.parse(selectedValue)[0].value : params.attributeDefaultValue;
        }
        return await super.computeWidgetState(...arguments);
    }
    /**
     * Reads target's attributes and creates CSS selectors.
     * Stores them in data-attributes to then be reapplied by
     * content/inject_dom.js (ideally we should save them in a <style> tag
     * directly but that would require a new website.page field and would not
     * be possible in dynamic (controller) pages... maybe some day).
     *
     */
    async updateCSSSelectors() {
        // There are 2 data attributes per option:
        // - One that stores the current records selected
        // - Another that stores the value of the rule "Hide for / Visible for"
        const visibilityIDParts = [];
        const onlyAttributes = [];
        const hideAttributes = [];
        for (const attribute of this.optionsAttributes) {
            if (this.target.dataset[attribute.saveAttribute]) {
                let records = JSON.parse(this.target.dataset[attribute.saveAttribute]);
                // TODO OWL: remove the following condition once all the options of
                // the Many2ManyWidget have been converted to OWL's WeMany2Many.
                // Then, `updateCSSSelectors()` won't need to be async.
                if (["visibilityValueLang", "visibilityValueCountry"].includes(attribute.saveAttribute)) {
                    const recordsProms = records.map(record => {
                        return this.orm.read(
                            attribute.model,
                            [record.id],
                            [attribute.callWith],
                        );
                    });
                    records = (await Promise.all(recordsProms)).map(result => result[0]);
                }
                records = records.map(record => {
                    return { id: record.id, value: record[attribute.callWith] };
                });
                if (attribute.saveAttribute === "visibilityValueLang") {
                    records = records.map(lang => {
                        lang.value = lang.value.replace(/_/g, '-');
                        return lang;
                    });
                }
                const hideFor = this.target.dataset[`${attribute.saveAttribute}Rule`] === "hide";
                if (hideFor) {
                    hideAttributes.push({ name: attribute.attributeName, records: records});
                } else {
                    onlyAttributes.push({ name: attribute.attributeName, records: records});
                }
                // Create a visibilityId based on the options name and their
                // values. eg: hide for en_US(id:1) -> lang1h
                const type = attribute.attributeName.replace("data-", "");
                const valueIDs = records.map(record => record.id).sort();
                visibilityIDParts.push(`${type}_${hideFor ? 'h' : 'o'}_${valueIDs.join('_')}`);
            }
        }
        const visibilityId = visibilityIDParts.join('_');
        // Creates CSS selectors based on those attributes, the reducers
        // combine the attributes' values.
        let selectors = '';
        for (const attribute of onlyAttributes) {
            // example of selector:
            // html:not([data-attr-1="valueAttr1"]):not([data-attr-1="valueAttr2"]) [data-visibility-id="ruleId"]
            const selector = attribute.records.reduce((acc, record) => {
                return acc += `:not([${attribute.name}="${record.value}"])`;
            }, 'html') + ` body:not(.editor_enable) [data-visibility-id="${visibilityId}"]`;
            selectors += selector + ', ';
        }
        for (const attribute of hideAttributes) {
            // html[data-attr-1="valueAttr1"] [data-visibility-id="ruleId"],
            // html[data-attr-1="valueAttr2"] [data-visibility-id="ruleId"]
            const selector = attribute.records.reduce((acc, record, i, a) => {
                acc += `html[${attribute.name}="${record.value}"] body:not(.editor_enable) [data-visibility-id="${visibilityId}"]`;
                return acc + (i !== a.length - 1 ? ',' : '');
            }, '');
            selectors += selector + ', ';
        }
        selectors = selectors.slice(0, -2);
        if (selectors) {
            this.target.dataset.visibilitySelectors = selectors;
        } else {
            delete this.target.dataset.visibilitySelectors;
        }

        if (visibilityId) {
            this.target.dataset.visibilityId = visibilityId;
        } else {
            delete this.target.dataset.visibilityId;
        }
    }
}
registry.category("snippets_options").add("ConditionalVisibility", {
    component: ConditionalVisibility,
    template: "website.ConditionalVisibility",
    selector: "section",
});
