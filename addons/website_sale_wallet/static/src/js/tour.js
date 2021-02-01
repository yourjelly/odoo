odoo.define('website_sale_wallet.tour', function (require) {
    "use strict";

    var core = require('web.core');
    var tour = require('web_tour.tour');

    var _t = core._t;

    tour.register('website_sale_wallet_tour', {
            url: "/web",
        }, [
            tour.stepUtils.showAppsMenuItem(),
            {
                trigger: '.o_app[data-menu-xmlid="website.menu_website_configuration"]',
                content: _t('Want to <b>activate gift card</b><br/><i>in e-commerce.?</i>'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: '[data-menu-xmlid="website.menu_website_global_configuration"]',
                content: _t('Click on Configuration'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: '[data-menu-xmlid="website.menu_website_website_settings"]',
                content: _t('Click on Setting'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: 'div[name="module_website_sale_wallet"]',
                content: _t('Activate gift card option'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: 'button[name="execute"]',
                content: _t('Save'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: '[data-menu-xmlid="website_sale.menu_catalog"]',
                content: _t('Open product menu'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: '[data-menu-xmlid="website_sale_wallet.website_product_gift_card_menu"]',
                content: _t('Open gift card list'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: ".o_list_button_add",
                content: _t("Let's create your first gift card."),
                position: "bottom",
            },
            {
                trigger: "div[name=amount] input",
                content: _t("Set an initial amount for gift card."),
                position: "bottom",
            },
            {
                trigger: 'div[name=amount] input',
                content: _t('Save'),
                position: 'bottom',
            }, {
                trigger: 'span[name=code]',
                content: _t('Copy gift card code to use it for client'),
                position: 'bottom',
            run: 'click',

            }, {
                trigger: '.o_menu_brand',
                content: _t('go to dashboard'),
                position: 'bottom',
                run: 'click',
            }, {
                trigger: '.o_cp_buttons a',
                content: _t('go to website'),
                position: 'bottom',
                run: 'click',
            }, {
                trigger: '#top_menu li:last-child .dropdown-toggle',
                content: _t('open menu'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: 'nav-item div[role="menu"] a[role="menuitem"]',
                content: _t('Select my account.'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: '[href="/my/wallet_transactions"]',
                content: _t('Select my transactions.'),
                position: 'bottom',
                run: 'click',
            },
            {
                trigger: "div[name=gift_card_code] input",
                content: _t("Paste selected gift card code."),
                position: "bottom",
            },
            {
                trigger: "form[name=gift_card_code] input[type='submit']",
                content: _t("Add gift card code."),
                position: "bottom",
                run: 'click'
            },
        ]
    )
})
