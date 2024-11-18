import { renderToElement } from "@web/core/utils/render";
import options from "@web_editor/js/editor/snippets.options";
import "@website/js/editor/snippets.options";

options.registry.CarouselCards = options.registry.CarouselBottomControllers.extend({
    /**
     * Toggle card images.
     */
    toggleCardImg() {
        const carouselEl = this.$target[0].closest(".carousel");
        const currentImageWrapperEls = carouselEl.querySelectorAll("figure");
        const cardEls = carouselEl.querySelectorAll(".card");

        if(carouselEl.classList.contains("s_carousel_cards_with_img")) {
            cardEls.forEach((cardEl) => {
                const imageWrapperEl = renderToElement("website.s_carousel_cards.imageWrapper");
                cardEl.insertAdjacentElement("afterbegin", imageWrapperEl);
            });
        } else {
            currentImageWrapperEls.forEach((elt) => elt.remove());
        }
    },
});

options.registry.CarouselCardsImageOptions = options.Class.extend({
    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------
    /**
     * Aligns the image inside the cover.
     *
     * @private
     */
    alignCoverImage() {
        const ratio = this._getImageToWrapperRatio();
        const imageWrapperEl = this.$target[0].querySelector(".o_card_img_wrapper");
        imageWrapperEl.classList.toggle("o_card_img_adjust_v", ratio > 1);
        imageWrapperEl.classList.toggle("o_card_img_adjust_h", ratio < 1);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * Compares the aspect ratio of the card image to its wrapper.
     *
     * @private
     * @returns {number} Ratio comparison value:
     *                   -  1: img and wrapper have identical aspect ratios
     *                   - <1: img is more portrait (taller) than wrapper
     *                   - >1: img is more landscape (wider) than wrapper
     */
    _getImageToWrapperRatio() {
        const imageEl = this.$target[0].querySelector(".o_card_img");
        const imageWrapperEl = this.$target[0].querySelector(".o_card_img_wrapper");
        if (!imageEl || !imageWrapperEl) {
            return false;
        }

        const imgRatio = imageEl.naturalHeight / imageEl.naturalWidth;
        const wrapperRatio = imageWrapperEl.offsetHeight / imageWrapperEl.offsetWidth;

        return imgRatio / wrapperRatio;
    },
});
