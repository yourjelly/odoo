odoo.define('website.footer.scrollTop', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');

    publicWidget.registry.scrollTop = publicWidget.Widget.extend({
        selector: "#o_footer_scrolltop",

        events: {
            'click': '_onClick',
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {Event} ev
         */
        _onClick: function (ev) {
            ev.preventDefault();
            $('html, body').animate({scrollTop : 0}, "slow");
        },
    });
});
