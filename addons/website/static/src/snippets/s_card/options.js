/** @odoo-module **/

import { renderToElement } from "@web/core/utils/render";
import options from "@web_editor/js/editor/snippets.options";


options.registry.CardImageOptions = options.Class.extend({
    /**
     * @override
     */
    start: function () {
        this._computeRadios();
    },

    /**
     * @override
     */
    updateUIVisibility: async function () {
        await this._super(...arguments);

        const hasImg = this.$target.find('.o_card_img_wrapper').length > 0;
        const useImgTop = this.$target.hasClass('o_card_img_top');
        const useRatio = hasImg ? this.$target.find('.o_card_img_wrapper').hasClass('ratio') : false;
        const useCustomRatio = this.$target.find('.o_card_img_ratio_custom').length > 0;
        const useSquareRatio = this.$target.find('.ratio-1x1').length > 0;

        // Hide the entire options block
        this.$el.toggleClass('d-none', !hasImg);

        // Hide controllers selectively
        this.$el.find('.o_card_img_ratio_range_option').toggleClass('d-none', !useImgTop || (useImgTop && !useCustomRatio));
        this.$el.find('.o_card_img_ratio_align_option').toggleClass('d-none', !useRatio || useSquareRatio);
    },

    /**
     * @override
     */
    _computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'selectImageClass': {
                const $image = this.$target.find('.o_card_img');

                for (const possibleValue of params.possibleValues) {
                    if ($image.hasClass(possibleValue)) {
                        return possibleValue;
                    }
                }
            }
        }

        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Change the cover image position.
     *
     * @see this.selectClass for parameters
     */
    selectImageClass: function (previewMode, widgetValue, params) {
        const $image = this.$target.find('.o_card_img');

        for (const possibleValue of params.possibleValues) {
            $image.removeClass(possibleValue);
        }

        $image.addClass(widgetValue);
    },

    /**
     * Remove the cover
     */
    imageRemove: function () {
        this.$target.find('.o_card_img_wrapper').remove();
    },

    /**
     * Align image inside the cover
     */
    imageAlignment: function () {
        this._computeRadios();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Change the alignment controller behavior according to the image ratio.
     */
    _computeRadios: function () {
        const $img = this.$target.find('.o_card_img');
        const $wrapper = this.$target.find('.o_card_img_wrapper');

        if ($img.length === 0 || $wrapper.length === 0) { return; }

        const imgRatio =  $img[0].offsetHeight / $img[0].offsetWidth;
        const wrapperRatio =  $wrapper[0].offsetHeight / $wrapper[0].offsetHeight;
        const alignVertically = imgRatio <= wrapperRatio;

        this.$target.toggleClass('o_card_img_adjust_v', alignVertically);
        this.$target.toggleClass('o_card_img_adjust_h', !alignVertically);
    },
});

options.registry.CardImageInjection = options.Class.extend({
    /**
     * @override
     */
    updateUIVisibility: async function () {
        await this._super(...arguments);

        const hasImg = this.$target.find('.o_card_img_wrapper').length > 0;
        this.$el.toggleClass('d-none', hasImg);
    },


    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Inject a new cover image
     */
    imageAdd: function () {
        if (this.$target.find('.o_card_img_wrapper').length > 0) { return; }

        const figure = renderToElement('website.s_card.imageWrapper');
        this.$target.prepend(figure);
    },
});
