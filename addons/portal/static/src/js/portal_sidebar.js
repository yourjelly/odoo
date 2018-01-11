odoo.define('portal.o_portal_sidebar', function(require) {
    'use strict';

    require('web.dom_ready');
    var config = require('web.config');

    if (!$('.o_portal_sidebar').length) {
        return $.Deferred().reject("DOM doesn't contain '.o_portal_sidebar'");
    }

    var $bs_sidebar = $(".o_portal_sidebar .bs-sidebar");
    $(window).on('resize', _.throttle(adapt_sidebar_position, 200, {
        leading: false
    }));
    adapt_sidebar_position();

    function adapt_sidebar_position() {
        $bs_sidebar.css({
            position: "relative",
            width: "",
        });
        if (config.device.size_class >= config.device.SIZES.MD) {
            $bs_sidebar.css({
                position: "fixed",
                width: $bs_sidebar.outerWidth(),
            });
        }
    }

    $bs_sidebar.affix({
        offset: {
            top: 0,
            bottom: $('body').height() - $('#wrapwrap').outerHeight() + $("footer").outerHeight(),
        },
    });
});