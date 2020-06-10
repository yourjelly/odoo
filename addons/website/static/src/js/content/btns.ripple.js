odoo.define('website.btns.ripple', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');

    // Ripple animation
    publicWidget.registry.ripple = publicWidget.Widget.extend({
        selector: ".btn, .dropdown-item, .dropdown-toggle",
        events: {
            'click': '_onClick',
        },

        /**
        * @override
        */
        start: function () {
            this.diameter = Math.max(this.$target.outerWidth(), this.$target.outerHeight());
            this.offsetX = this.$target.offset().left;
            this.offsetY = this.$target.offset().top;
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {Event} ev
         */
        _onClick: function (ev) {
            let $el = this.$target;
            let duration = 350;
            let $ripple = this.$target.find('.o_btn_ripple');

            if ($ripple.length === 0) {
                $ripple = $('<span>').addClass('o_btn_ripple').appendTo(this.$target);
            }

            $el.removeClass('o_js_btn_has_ripple');

            $ripple.css({
                top: ev.pageY - this.offsetY - this.diameter / 2,
                left: ev.pageX - this.offsetX - this.diameter / 2,
                animationDuration: duration + 'ms',
                height: this.diameter,
                width: this.diameter
            });

            this.$target.addClass('o_js_btn_has_ripple');

            setTimeout(function () {
                $el.removeClass('o_js_btn_has_ripple');
            }, duration);
        },
    });
});
