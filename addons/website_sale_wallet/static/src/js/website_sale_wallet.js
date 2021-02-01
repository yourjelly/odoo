odoo.define('website_sale_wallet.website_sale_wallet', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');

    publicWidget.registry.WebsiteSaleWallet = publicWidget.Widget.extend({
            selector: '.oe_website_sale',
            events: {
                'click .show_wallet': '_onClickShowWallet',
            },
            /**
             * @private
             * @param {Event} ev
             */
            _onClickShowWallet: function (ev) {
                $(ev.currentTarget).hide();
                $('.wallet_form').removeClass('d-none');
            }
        }
    )
    publicWidget.registry.websiteLinksCharts = publicWidget.Widget.extend({
        selector: '.o_purchased_gift_card',
        /**
         * @override
         */
        start: function () {
            new ClipboardJS($('.copy-to-clipboard')[0]);
        }
    })
})
