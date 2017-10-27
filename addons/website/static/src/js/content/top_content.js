odoo.define('website.content.top_content', function (require) {
'use strict';
    require('web.dom_ready');
    var top_content = false;
    var $wrapwrap = $("#wrapwrap");
    var $wrap = $("#wrap");
        // Top content layout
        if ($wrap.find(".push_to_top, #title.blog_header > .cover.cover_full").length > 0) {
            top_content = true;
            $wrapwrap.addClass("top_content");
        }

        $(window).load(function () {})
            // Resize
            .on("resize", function () {
                if (top_content) {
                    var s = $wrap.find(".push_to_top, #title.blog_header > .cover.cover_full").height();
                    $wrap.css("margin-top", s);
                }
            })
            .trigger("resize");
});
