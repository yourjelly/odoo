/** @odoo-module **/

import { uniqueId } from "@web/core/utils/functions";
import publicWidget from "@web/legacy/js/public/public_widget";
import { renderToElement } from "@web/core/utils/render";

export const CAROUSEL_SLIDING_CLASS = "o_carousel_sliding";

/**
 * @param {HTMLElement} carouselEl
 * @returns {Promise<void>}
 */
export async function waitForCarouselToFinishSliding(carouselEl) {
    if (!carouselEl.classList.contains(CAROUSEL_SLIDING_CLASS)) {
        return;
    }
    return new Promise(resolve => {
        carouselEl.addEventListener("slid.bs.carousel", () => resolve(), {once: true});
    });
}

/**
 * This class is used to fix carousel auto-slide behavior in Odoo 17.4 and up.
 * It handles upgrade cases from lower versions.
 * TODO find a way to get rid of this with an upgrade script?
 */
const CarouselBootstrapUpgradeFix = publicWidget.Widget.extend({
    // Only consider our known carousel snippets. A bootstrap carousel could
    // have been added in an embed code snippet, or in any custom snippet. In
    // that case, we consider that it should use the new default BS behavior,
    // assuming the user / the developer of the custo should have updated the
    // behavior as wanted themselves.
    // Note: dynamic snippets are handled separately (TODO review).
    selector: [
        "[data-snippet='s_image_gallery'] .carousel",
        "[data-snippet='s_carousel'] .carousel",
        "[data-snippet='s_quotes_carousel'] .carousel",
    ].join(", "),
    disabledInEditableMode: false,
    events: {
        "slide.bs.carousel": "_onSlideCarousel",
        "slid.bs.carousel": "_onSlidCarousel",
    },
    OLD_AUTO_SLIDING_SNIPPETS: ["s_image_gallery"],

    /**
     * @override
     */
    async start() {
        await this._super(...arguments);

        const hasInterval = ![undefined, "false", "0"].includes(this.el.dataset.bsInterval);
        if (!hasInterval && this.el.dataset.bsRide) {
            // A bsInterval of 0 (or false or undefined) is intended to not
            // auto-slide. With current Bootstrap version, a value of 0 will
            // mean auto-slide without any delay (very fast). To prevent this,
            // we remove the bsRide.
            delete this.el.dataset.bsRide;
            await this._destroyCarouselInstance();
            window.Carousel.getOrCreateInstance(this.el);
        } else if (hasInterval && !this.el.dataset.bsRide) {
            // Re-add bsRide on carousels that don't have it but still have
            // a bsInterval. E.g. s_image_gallery must auto-slide on load,
            // while others only auto-slide on mouseleave.
            //
            // In the case of s_image_gallery that has a bsRide = "true"
            // instead of "carousel", it's better not to change the behavior and
            // let the user update the snippet manually to avoid making changes
            // that they don't expect.
            const snippetName = this.el.closest("[data-snippet]").dataset.snippet;
            this.el.dataset.bsRide = this.OLD_AUTO_SLIDING_SNIPPETS.includes(snippetName) ? "carousel" : "true";
            await this._destroyCarouselInstance();
            window.Carousel.getOrCreateInstance(this.el);
        }
    },
    /**
     * @override
     */
    destroy() {
        this._super(...arguments);
        this.el.classList.remove(CAROUSEL_SLIDING_CLASS);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _destroyCarouselInstance() {
        await waitForCarouselToFinishSliding(this.el); // Prevent traceback
        window.Carousel.getInstance(this.el)?.dispose();
    },
    /**
     * @private
     */
    _onSlideCarousel(ev) {
        ev.currentTarget.classList.add(CAROUSEL_SLIDING_CLASS);
    },
    /**
     * @private
     */
    _onSlidCarousel(ev) {
        ev.currentTarget.classList.remove(CAROUSEL_SLIDING_CLASS);
    },
});

const GalleryWidget = publicWidget.Widget.extend({

    selector: '.s_image_gallery:not(.o_slideshow)',
    events: {
        'click img': '_onClickImg',
    },

    /**
     * @override
     */
    start() {
        this._super(...arguments);
        this.originalSources = [...this.el.querySelectorAll("img")].map(img => img.getAttribute("src"));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when an image is clicked. Opens a dialog to browse all the images
     * with a bigger size.
     *
     * @private
     * @param {Event} ev
     */
    _onClickImg: function (ev) {
        const clickedEl = ev.currentTarget;
        if (this.$modal || clickedEl.matches("a > img")) {
            return;
        }
        var self = this;

        let imageEls = this.el.querySelectorAll("img");
        const currentImageEl = clickedEl.closest("img");
        const currentImageIndex = [...imageEls].indexOf(currentImageEl);
        // We need to reset the images to their original source because it might
        // have been changed by a mouse event (e.g. "hover effect" animation).
        imageEls = [...imageEls].map((el, i) => {
            const cloneEl = el.cloneNode(true);
            cloneEl.src = this.originalSources[i];
            return cloneEl;
        });

        var size = 0.8;
        var dimensions = {
            min_width: Math.round(window.innerWidth * size * 0.9),
            min_height: Math.round(window.innerHeight * size),
            max_width: Math.round(window.innerWidth * size * 0.9),
            max_height: Math.round(window.innerHeight * size),
            width: Math.round(window.innerWidth * size * 0.9),
            height: Math.round(window.innerHeight * size)
        };

        const milliseconds = this.el.dataset.interval || false;
        this.$modal = $(renderToElement('website.gallery.slideshow.lightbox', {
            images: imageEls,
            index: currentImageIndex,
            dim: dimensions,
            interval: milliseconds || 0,
            ride: !milliseconds ? "false" : "carousel",
            id: uniqueId("slideshow_"),
        }));
        this.__onModalKeydown = this._onModalKeydown.bind(this);
        this.$modal.on('hidden.bs.modal', function () {
            $(this).hide();
            $(this).siblings().filter('.modal-backdrop').remove(); // bootstrap leaves a modal-backdrop
            this.removeEventListener("keydown", self.__onModalKeydown);
            $(this).remove();
            self.$modal = undefined;
        });
        this.$modal.one('shown.bs.modal', function () {
            self.trigger_up('widgets_start_request', {
                editableMode: false,
                $target: self.$modal.find('.modal-body.o_slideshow'),
            });
            this.addEventListener("keydown", self.__onModalKeydown);
        });
        this.$modal.appendTo(document.body);
        const modalBS = new Modal(this.$modal[0], {keyboard: true, backdrop: true});
        modalBS.show();
    },
    _onModalKeydown(ev) {
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            const side = ev.key === "ArrowLeft" ? "prev" : "next";
            this.$modal[0].querySelector(`.carousel-control-${side}`).click();
        }
        if (ev.key === "Escape") {
            // If the user is connected as an editor, prevent the backend header
            // from collapsing.
            ev.stopPropagation();
        }
    },
});

const GallerySliderWidget = publicWidget.Widget.extend({
    selector: '.o_slideshow',
    disabledInEditableMode: false,

    /**
     * @override
     */
    start: function () {
        var self = this;
        this.$carousel = this.$el.is('.carousel') ? this.$el : this.$('.carousel');
        this.$indicator = this.$carousel.find('.carousel-indicators');
        this.$prev = this.$indicator.find('li.o_indicators_left').css('visibility', ''); // force visibility as some databases have it hidden
        this.$next = this.$indicator.find('li.o_indicators_right').css('visibility', '');
        var $lis = this.$indicator.find('li[data-bs-slide-to]');
        let indicatorWidth = this.$indicator.width();
        if (indicatorWidth === 0) {
            // An ancestor may be hidden so we try to find it and make it
            // visible just to take the correct width.
            const $indicatorParent = this.$indicator.parents().not(':visible').last();
            if (!$indicatorParent[0].style.display) {
                $indicatorParent[0].style.display = 'block';
                indicatorWidth = this.$indicator.width();
                $indicatorParent[0].style.display = '';
            }
        }
        let nbPerPage = Math.floor(indicatorWidth / $lis.first().outerWidth(true)) - 3; // - navigator - 1 to leave some space
        var realNbPerPage = nbPerPage || 1;
        var nbPages = Math.ceil($lis.length / realNbPerPage);

        var index;
        var page;
        update();

        function hide() {
            $lis.each(function (i) {
                $(this).toggleClass('d-none', i < page * nbPerPage || i >= (page + 1) * nbPerPage);
            });
            if (page <= 0) {
                self.$prev.detach();
            } else {
                self.$prev.removeClass('d-none');
                self.$prev.prependTo(self.$indicator);
            }
            if (page >= nbPages - 1) {
                self.$next.detach();
            } else {
                self.$next.removeClass('d-none');
                self.$next.appendTo(self.$indicator);
            }
        }

        function update() {
            const active = $lis.filter('.active');
            index = active.length ? $lis.index(active) : 0;
            page = Math.floor(index / realNbPerPage);
            hide();
        }

        this.$carousel.on('slide.bs.carousel.gallery_slider', function () {
            setTimeout(function () {
                var $item = self.$carousel.find('.carousel-inner .carousel-item-prev, .carousel-inner .carousel-item-next');
                var index = $item.index();
                $lis.removeClass('active')
                    .filter('[data-bs-slide-to="' + index + '"]')
                    .addClass('active');
            }, 0);
        });
        this.$indicator.on('click.gallery_slider', '> li:not([data-bs-slide-to])', function () {
            page += ($(this).hasClass('o_indicators_left') ? -1 : 1);
            page = Math.max(0, Math.min(nbPages - 1, page)); // should not be necessary
            self.$carousel.carousel(page * realNbPerPage);
            // We dont use hide() before the slide animation in the editor because there is a traceback
            // TO DO: fix this traceback
            if (!self.editableMode) {
                hide();
            }
        });
        this.$carousel.on('slid.bs.carousel.gallery_slider', update);

        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);

        if (!this.$indicator) {
            return;
        }

        this.$prev.prependTo(this.$indicator);
        this.$next.appendTo(this.$indicator);
        this.$carousel.off('.gallery_slider');
        this.$indicator.off('.gallery_slider');
    },
});

publicWidget.registry.CarouselBootstrapUpgradeFix = CarouselBootstrapUpgradeFix;
publicWidget.registry.gallery = GalleryWidget;
publicWidget.registry.gallerySlider = GallerySliderWidget;

export default {
    CarouselBootstrapUpgradeFix: CarouselBootstrapUpgradeFix,
    GalleryWidget: GalleryWidget,
    GallerySliderWidget: GallerySliderWidget,
};
