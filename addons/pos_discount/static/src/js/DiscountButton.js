odoo.define('pos_discount.DiscountButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class DiscountButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        async onClick() {
            var self = this;
            const order = this.env.pos.get_order();
            const { confirmed, payload } = await this.showPopup('DiscountPopup',{
                title: this.env._t('Global Discount'),
                startingValue: order.global_discount,
                isInputSelected: true,
                amountText: this.env.pos.currency.symbol,
            });
            if (confirmed) {
                const type = payload.type
                const val = Math.round(Math.max(0,Math.min(100,parseFloat(payload.value))));
                await self.apply_discount(val, type);
            }
        }

        apply_discount(val, type) {
            const order = this.env.pos.get_order();
            order.setGlobalDiscount(val, type);
        }
    }
    DiscountButton.template = 'DiscountButton';

    ProductScreen.addControlButton({
        component: DiscountButton,
        condition: function() {
            return this.env.pos.config.module_pos_discount && this.env.pos.config.discount_product_id;
        },
    });

    Registries.Component.add(DiscountButton);

    return DiscountButton;
});
