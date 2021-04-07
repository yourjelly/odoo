odoo.define('point_of_sale.PaymentScreenElectronicPayment', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    /**
     * @prop {{ line: 'pos.payment' }}
     * @emits 'send-payment-request' @payload {['pos.payment', ...otherArgs]}
     * @emits 'send-payment-cancel' @payload {['pos.payment', ...otherArgs]}
     * @emits 'send-payment-reverse' @payload {['pos.payment', ...otherArgs]}
     * @emits 'send-force-done' @payload {['pos.payment', ...otherArgs]}
     */
    class PaymentScreenElectronicPayment extends PosComponent {
        getPendingMessage(payment) {
            return this.env._t('Payment request pending');
        }
        getCancelledMessage(payment) {
            return this.env._t('Transaction cancelled');
        }
    }
    PaymentScreenElectronicPayment.template = 'PaymentScreenElectronicPayment';

    return PaymentScreenElectronicPayment;
});
