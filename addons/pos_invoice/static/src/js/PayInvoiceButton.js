odoo.define('pos_invoice.PayInvoiceButton', function (require) {
    'use strict';

    const models = require('point_of_sale.models');
    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class PayInvoiceButton extends PosComponent {
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
            let { confirmed, payload: id } = await this.showPopup('TextInputPopup', {
                title: this.env._t('Enter Promotion or Coupon Code'),
                startingValue: '',
            });
            if (!confirmed || !id) {
                return;
            }
            id = parseInt(id, 10);
            const [invoice] = await this.rpc({
                model: 'account.move',
                method: 'read',
                args: [[id]],
                kwargs: {
                    fields: ['amount_residual'],
                },
            });
            if (!invoice) {
                return this.showPopup('ErrorPopup', {
                    title: 'Unknown Invoice',
                    body: "Can't find invoice with that id.",
                });
            }
            const order = this.env.pos.get_order();
            const new_line = new models.Orderline({}, {
                pos: this.env.pos,
                order: order,
                // TODO jcb - need to provide a dynamic product, and not 51
                product: this.env.pos.db.get_product_by_id(51),
                price: invoice.amount_residual,
                price_manually_set: true,
            });
            order.add_orderline(new_line);
            order.paid_invoice_id = invoice.id;
        }
    }
    PayInvoiceButton.template = 'pos_invoice.PayInvoiceButton';

    ProductScreen.addControlButton({
        component: PayInvoiceButton,
        condition: function () {
            // TODO jcb - proper condition to show it
            return true;
        },
    });

    Registries.Component.add(PayInvoiceButton);

    return PayInvoiceButton;
});
