odoo.define('point_of_sale.RefundButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    class RefundButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        mounted() {
            this.env.pos.get('orders').on('add remove change', () => this.render(), this);
            this.env.pos.on('change:selectedOrder', () => this.render(), this);
        }
        willUnmount() {
            this.env.pos.get('orders').off('add remove change', null, this);
            this.env.pos.off('change:selectedOrder', null, this);
        }
        onClick() {
            const customer = this.env.pos.get_order().get_client();
            const searchDetails = customer ? { fieldName: 'CUSTOMER', searchTerm: customer.name } : null
            this.showScreen('TicketScreen', { filter: 'SYNCED', orderToPutRefund: this.env.pos.get_order(), searchDetails });
        }
    }
    RefundButton.template = 'point_of_sale.RefundButton';

    ProductScreen.addControlButton({
        component: RefundButton,
        condition: function () {
            return true;
        },
    });

    Registries.Component.add(RefundButton);

    return RefundButton;
});
