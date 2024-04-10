odoo.define('website.s_facebook_page', function (require) {
'use strict';

var publicWidget = require('web.public.widget');
var utils = require('web.utils');

const FacebookPageWidget = publicWidget.Widget.extend({
    selector: '.o_facebook_page',
    disabledInEditableMode: false,

    /**
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);

        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerUnactive();

        this._render();
        window.addEventListener('resize', this._render.bind(this));

        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerActive();
        return def;
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);

        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerUnactive();
        if (this.$iframe) {
            this.$iframe.remove();
        }
        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerActive();
    },
    //
    _render: function () {
        const params = _.pick(this.$el[0].dataset, 'href', 'id', 'height', 'tabs', 'small_header', 'hide_cover');
        if (!params.href) {
            return;
        }
        if (params.id) {
            params.href = `https://www.facebook.com/${params.id}`;
        }
        delete params.id;
        params.width = utils.confine(Math.floor(this.$el.width()), 180, 500);
        const src = $.param.querystring('https://www.facebook.com/plugins/page.php', params);
        const iframeEl = Object.assign(document.createElement('iframe'), {
            src: src,
            width: params.width,
            height: params.height,
            css: {
                border: 'none',
                overflow: 'hidden',
            },
            scrolling: 'no',
            frameborder: '0',
            allowTransparency: 'true',
        });
        this.el.replaceChildren(iframeEl);
    },
});

publicWidget.registry.facebookPage = FacebookPageWidget;

return FacebookPageWidget;
});
