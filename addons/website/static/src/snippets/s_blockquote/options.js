/** @odoo-module **/

import options from "@web_editor/js/editor/snippets.options";

options.registry.Blockquote = options.Class.extend({

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Change blockquote design.
     *
     * @see this.selectClass for parameters
     */
    display: function (previewMode, widgetValue, params) {

        // Cover
        const $blockquoteInfos = this.$target.find('.s_blockquote_infos');
        if (widgetValue === 'cover') {
            $blockquoteInfos.css({"background-image": "url('/web/image/website.s_blockquote_default_image')"});
            $blockquoteInfos.find('.s_blockquote_author').addClass('o_cc o_cc5')
            $blockquoteInfos.addClass('oe_img_bg o_bg_img_center');
            $blockquoteInfos.find('.s_blockquote_avatar').addClass('d-none');
        } else {
            $blockquoteInfos.css({"background-image": ""});
            $blockquoteInfos.css({"background-position": ""});
            $blockquoteInfos.removeClass('oe_img_bg o_bg_img_center');
            $blockquoteInfos.find('.o_we_bg_filter').remove();
            $blockquoteInfos.find('.s_blockquote_filter').contents().unwrap(); // Compatibility
            $blockquoteInfos.find('.s_blockquote_author').removeClass('o_cc o_cc5');
            $blockquoteInfos.find('.s_blockquote_avatar').removeClass('d-none');
        }
    },
});
