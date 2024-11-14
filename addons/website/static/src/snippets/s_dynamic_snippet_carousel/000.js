import publicWidget from "@web/legacy/js/public/public_widget";
import DynamicSnippet from "@website/snippets/s_dynamic_snippet/000";
import { utils as uiUtils } from "@web/core/ui/ui_service";
const DEFAULT_NUMBER_OF_ELEMENTS_SM = 1
const DEFAULT_NUMBER_OF_ELEMENTS = 4

const DynamicSnippetCarousel = DynamicSnippet.extend({
    selector: '.s_dynamic_snippet_carousel',
    events: {
        'click .o_carousel_control_prev': '_onClickControlPrev',
        'click .o_carousel_control_next': '_onClickControlNext',
    },
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.template_key = 'website.s_dynamic_snippet.carousel';
        this.scrollPosition = 0;
    },

    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments);
        this.scrollMode = this.el.dataset.scrollMode || 'page';
        this._handleScrollMode();
    },

    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        this._stopSingleScrollAnimation();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getQWebRenderOptions: function () {
        return Object.assign(
            this._super.apply(this, arguments),
            {
                interval: parseInt(this.el.dataset.carouselInterval),
                rowPerSlide: parseInt(uiUtils.isSmall() ? 1 : this.el.dataset.rowPerSlide || 1),
                arrowPosition: this.el.dataset.arrowPosition || '',
                scrollMode: uiUtils.isSmall() ? 'page' : this.el.dataset.scrollMode || 'page',
            },
        );
    },

    _handleScrollMode: function () {
        if (this.scrollMode === 'single') {
            this._addSingleScrollAnimation();
        }
        else{
            this._stopSingleScrollAnimation();
        }
    },

    _addSingleScrollAnimation: function () {
        this.scrollInterval = setInterval(() => {
            this._onClickControlNext();
        }, this.el.dataset.carouselInterval || 5000); // Call every 5000ms (5 seconds)
    },

    _stopSingleScrollAnimation: function () {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    },

    _onClickControlNext: function(ev) {
        const carouselInner = $(ev ? ev.delegateTarget : this.el).find(".o_carousel_inner");
        const carouselItem = $(ev ? ev.delegateTarget : this.el).find(".o_carousel_item");
        const currentPos = this.scrollPosition;
        if (carouselInner.length && carouselItem.length) {
            let numberOfElements;

            if (uiUtils.isSmall()) {
                numberOfElements = parseInt(this.el.dataset.numberOfElementsSmallDevices) || DEFAULT_NUMBER_OF_ELEMENTS_SM;
            } else {
                numberOfElements = parseInt(this.el.dataset.numberOfElements) || DEFAULT_NUMBER_OF_ELEMENTS;
            }

            const carouselWidth = carouselInner[0].scrollWidth;
            const cardWidth = carouselItem.width();

            this.scrollPosition += cardWidth

            if (this.scrollPosition + (cardWidth * numberOfElements) >= carouselWidth ) {
                this.scrollPosition = 0;
                carouselInner.animate({ scrollLeft: this.scrollPosition }, 400);
                $(ev ? ev.delegateTarget : this.el).find(".o_carousel_control_prev").hide();
            } else {
                carouselInner.animate({ scrollLeft: this.scrollPosition }, 400);
                $(ev ? ev.delegateTarget : this.el).find(".o_carousel_control_prev").show();

            }
            console.log("next:  " + currentPos + " -> " + this.scrollPosition);

        }
    },

    _onClickControlPrev: function(ev) {
        const carouselInner = $(ev ? ev.delegateTarget : this.el).find(".o_carousel_inner");
        const carouselItem = $(ev ? ev.delegateTarget : this.el).find(".o_carousel_item");
        const currentPos = this.scrollPosition;
        if (carouselInner.length && carouselItem.length) {
            const cardWidth = carouselItem.width();

            this.scrollPosition -= cardWidth;
            carouselInner.animate({scrollLeft: this.scrollPosition}, 600);

            if (this.scrollPosition < cardWidth) {
                $(ev ? ev.delegateTarget : this.el).find(".o_carousel_control_prev").hide();
            }
            console.log("prev:  " + currentPos + " -> " + this.scrollPosition);
        }

    },

});
publicWidget.registry.dynamic_snippet_carousel = DynamicSnippetCarousel;

export default DynamicSnippetCarousel;
