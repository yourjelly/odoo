odoo.define('web_editor.mobile', function (require) {
'use strict';

const Dialog = require('web.Dialog');

const MobilePreviewDialog = Dialog.extend({
    init: function (parent, options) {
        options = options || {};
        this.hasEditor = options.hasEditor;
        this._super(...arguments);
    },
    /**
     * Tweaks the modal so that it appears as a phone and modifies the iframe
     * rendering to show more accurate mobile view.
     *
     * @override
     */
    start: function () {
        var self = this;
        this.$modal.addClass('oe_mobile_preview');
        this.$modal.on('click', '.modal-header', function () {
            self.$el.toggleClass('o_invert_orientation');
        });
        if (this.hasEditor) {
            const $body = this.__parentedParent.$editable.clone();
            $body.prop('contenteditable', false);
            $body.find('img').not('.o_we_custom_image').addClass('h-100');
            $body.find('div.align-items-center').removeClass('align-items-center');
            $body.find('.no-gutters').removeClass('no-gutters');
            $body.appendTo(this.$el);
        } else {
            this.$iframe = $('<iframe/>', {
                id: 'mobile-viewport',
                src: $.param.querystring(window.location.href, 'mobilepreview'),
            });
            this.$iframe.on('load', function (e) {
                self.$iframe.contents().find('body').removeClass('o_connected_user');
                self.$iframe.contents().find('#oe_main_menu_navbar').remove();
            });
            this.$iframe.appendTo(this.$el);
        }

        return this._super.apply(this, arguments);
    },
});

return {
    MobilePreviewDialog,
};
});
