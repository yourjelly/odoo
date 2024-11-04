/** @odoo-module **/

import { Component, onWillDestroy, useAttachedEl } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { uniqueId } from "@web/core/utils/functions";
import { renderToElement } from "@web/core/utils/render";


export class GalleryWidget extends Component {
    static selector = ".s_image_gallery:not(.o_slideshow)";
    static dynamicContent = {
        "img": {
            "t-on-click": "clickImg",
        },
    };

    setup() {
        this.el = useAttachedEl();
        this.originalSources = [...this.el.querySelectorAll("img")].map(img => img.getAttribute("src"));
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when an image is clicked. Opens a dialog to browse all the images
     * with a bigger size.
     *
     * @param {Event} ev
     */
    clickImg(ev) {
        const clickedEl = ev.currentTarget;
        if (this.modalEl || clickedEl.matches("a > img")) {
            return;
        }

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
        const lightboxTemplate = this.el.dataset.vcss === "002" ?
            "website.gallery.s_image_gallery_mirror.lightbox" :
            "website.gallery.slideshow.lightbox";
        this.modalEl = renderToElement(lightboxTemplate, {
            images: imageEls,
            index: currentImageIndex,
            dim: dimensions,
            interval: milliseconds || 0,
            ride: !milliseconds ? "false" : "carousel",
            id: uniqueId("slideshow_"),
        });
        this.__onModalKeydown = this._onModalKeydown.bind(this);
        this.modalEl.addEventListener("hidden.bs.modal", () => {
            this.modalEl.classList.add("d-none");
            for (const backdropEl of this.modalEl.querySelectorAll(".modal-backdrop")) {
                backdropEl.remove(); // bootstrap leaves a modal-backdrop
            }
            this.modalEl.removeEventListener("keydown", this.__onModalKeydown);
            this.modalEl.remove();
            this.modalEl = undefined;
        });
        this.modalEl.addEventListener("shown.bs.modal", () => {
            // TODO Find out what was the purpose of that event.
            /*
            this.trigger_up("widgets_start_request", {
                editableMode: false,
                target: this.modalEl.querySelector(".modal-body.o_slideshow"),
            });
            */
            this.modalEl.addEventListener("keydown", this.__onModalKeydown);
        }, { once: true });
        document.body.append(this.modalEl);
        const modalBS = new Modal(this.modalEl, {keyboard: true, backdrop: true});
        modalBS.show();
    }
    _onModalKeydown(ev) {
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            const side = ev.key === "ArrowLeft" ? "prev" : "next";
            this.modalEl.querySelector(`.carousel-control-${side}`).click();
        }
        if (ev.key === "Escape") {
            // If the user is connected as an editor, prevent the backend header
            // from collapsing.
            ev.stopPropagation();
        }
    }
}

export class GallerySliderWidget extends Component {
    static selector = ".o_slideshow";
    // TODO Support edit-mode enabled.
    static disabledInEditableMode = false;

    setup() {
        this.el = useAttachedEl();
        onWillDestroy(this.destroy);
        // TODO Remove self.
        var self = this;
        this.carouselEl = this.el.classList.contains(".carousel") ? this.el : this.el.querySelector(".carousel");
        this.indicatorEl = this.carouselEl.querySelector(".carousel-indicators");
        this.prevEl = this.indicatorEl.querySelector("li.o_indicators_left");
        this.nextEl = this.indicatorEl.querySelector("li.o_indicators_right");
        this.prevEl.style.visibility = ""; // force visibility as some databases have it hidden
        this.nextEl.style.visibility = "";
        this.liEls = this.indicatorEl.querySelectorAll("li[data-bs-slide-to]");
        let indicatorWidth = this.indicatorEl.getBoundincClientRect().width;
        if (indicatorWidth === 0) {
            // An ancestor may be hidden so we try to find it and make it
            // visible just to take the correct width.
            let indicatorParentEl = this.indicatorEl.parentElement;
            while (indicatorParentEl) {
                if (!isVisible(indicatorParentEl)) {
                    if (!indicatorParentEl.style.display) {
                        indicatorParentEl.style.display = "block";
                        indicatorWidth = this.indicatorEl.getBoundingClientRect().width;
                        indicatorParentEl.style.display = "";
                    }
                    break;
                }
                indicatorParentEl = indicatorParentEl.parentElement;
            }
        }
        const nbPerPage = Math.floor(indicatorWidth / this.liEls[0].getBoundingClientRect().width) - 3; // - navigator - 1 to leave some space
        const realNbPerPage = nbPerPage || 1;
        const nbPages = Math.ceil(this.liEls.length / realNbPerPage);

        let index;
        let page;
        this.update();

        this.boundSlide = this.slide.bind(this);
        this.boundClickIndicator = this.clickIndicator.bind(this);
        this.boundUpdate = this.update.bind(this);
        this.carouselEl.addEventListener("slide.bs.carousel.gallery_slider", this.boundSlide);
        for (const liEl of this.indicatorEl.querySelectorAll(":scope > li:not([data-bs-slide-to])")) {
            liEl.addEventListener("click.gallery_slider", this.boundClickIndicator);
        }
        this.carouselEl.addEventListener("slid.bs.carousel.gallery_slider", this.boundUpdate);
    }
    slide() {
        setTimeout(() => {
            const itemEl = this.carouselEl.querySelector(".carousel-inner .carousel-item-prev, .carousel-inner .carousel-item-next");
            const index = [...itemEl.parentElement.children].indexOf(itemEl);
            for (const liEl of this.liEls) {
                liEl.classList.remove("active");
            }
            const selectedLiEl = this.liEls.querySelector(`[data-bs-slide-to="${index}"]`);
            selectedLiEl?.classList.add("active");
        }, 0);
    }
    clickIndicator() {
        page += this.el.classList.contains("o_indicators_left") ? -1 : 1;
        page = Math.max(0, Math.min(nbPages - 1, page)); // should not be necessary
        Carousel.getOrCreateInstance(this.carouselEl).carousel(page * realNbPerPage);
        // We dont use hide() before the slide animation in the editor because there is a traceback
        // TO DO: fix this traceback
        if (!this.editableMode) {
            this.hide();
        }
    }
    hide() {
        for (let i = 0; i < this.liEls.length; i++) {
            this.liEls[i].classList.toggle("d-none", i < page * nbPerPage || i >= (page + 1) * nbPerPage);
        }
        if (page <= 0) {
            this.prevEl.remove();
        } else {
            this.prevEl.classList.remove("d-none");
            this.indicatorEl.insertAdjacentElement("afterbegin", this.prevEl);
        }
        if (page >= nbPages - 1) {
            this.nextEl.remove();
        } else {
            this.nextEl.classList.remove("d-none");
            this.indicatorEl.appendChild(this.nextEl);
        }
    }

    update() {
        const active = this.liEls.filter(".active");
        index = active.length ? this.liels.index(active) : 0;
        page = Math.floor(index / realNbPerPage);
        this.hide();
    }
    destroy() {
        if (!this.indicatorEl) {
            return;
        }

        this.prevEl.prependTo(this.indicatorEl);
        this.nextEl.appendTo(this.indicatorEl);
        this.carouselEl.removeEventListener("slide.bs.carousel.gallery_slider", this.boundSlide);
        for (const liEl of this.indicatorEl.querySelectorAll(":scope > li:not([data-bs-slide-to])")) {
            liEl.removeEventListener("click.gallery_slider", this.boundClickIndicator);
        }
        this.carouselEl.removeEventListener("slid.bs.carousel.gallery_slider", this.boundUpdate);
    }
}

registry.category("website.active_elements").add("website.gallery", GalleryWidget);
registry.category("website.active_elements").add("website.gallerySlider", GallerySliderWidget);

export default {
    GalleryWidget: GalleryWidget,
    GallerySliderWidget: GallerySliderWidget,
};
