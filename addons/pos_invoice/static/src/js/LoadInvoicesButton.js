odoo.define('pos_invoice.LoadInvoicesButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    class LoadInvoicesButton extends PosComponent {
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
        async onClick() {
            this.showScreen('InvoiceListScreen');
        }
    }
    LoadInvoicesButton.template = 'pos_invoice.LoadInvoicesButton';

    ProductScreen.addControlButton({
        component: LoadInvoicesButton,
        condition: function () {
            return this.env.pos.config.module_pos_invoice;
        },
    });

    Registries.Component.add(LoadInvoicesButton);

    return LoadInvoicesButton;
});
