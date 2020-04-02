odoo.define('pos_reprint.ReprintButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require('web.custom_hooks');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class ReprintButton extends PosComponent {
        static template = 'ReprintButton';
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        async onClick() {
            if (this.env.pos.last_receipt_render_env) {
                await this.showTempScreen('ReprintScreen');
            } else {
                await this.showPopup('ErrorPopup', {
                    title: this.env._t('Nothing to Print'),
                    body: this.env._t('There is no previous receipt to print.'),
                });
            }
        }
    }

    ProductScreen.addControlButton({
        component: ReprintButton,
        condition: function() {
            return this.env.pos.config.module_pos_reprint;
        },
    });

    Registry.add(ReprintButton);

    return ReprintButton;
});
