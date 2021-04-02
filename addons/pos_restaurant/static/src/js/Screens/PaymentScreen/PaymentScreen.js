odoo.define('pos_restaurant.PosResPaymentScreen', function (require) {
    'use strict';

    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const { useListener } = require('web.custom_hooks');
    const { patch } = require('web.utils');

    return patch(PaymentScreen.prototype, 'pos_restaurant', {
        setup() {
            this._super(...arguments);
            useListener('send-payment-adjust', this._onSendPaymentAdjust);
        },
        _onSendPaymentAdjust({ detail: payment }) {
            this.env.noMutexActionHandler({ name: 'actionSendPaymentAdjust', args: [this.props.activeOrder, payment] });
        },
        get nextScreen() {
            const order = this.props.activeOrder;
            if (!this.env.model.config.set_tip_after_payment || order.is_tipped) {
                return this._super();
            }
            const payments = this.env.model.getPayments(order);
            // Take the first payment method as the main payment.
            const mainPayment = payments[0];
            if (this.env.model.canBeAdjusted(mainPayment)) {
                return 'TipScreen';
            }
            return this._super();
        },
    });
});
