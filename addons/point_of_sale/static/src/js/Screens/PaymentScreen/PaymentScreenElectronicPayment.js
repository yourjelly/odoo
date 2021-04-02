odoo.define('point_of_sale.PaymentScreenElectronicPayment', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    /**
     * @emits 'send-payment-request' @payload {'pos.payment'}
     * @emits 'send-payment-cancel' @payload {'pos.payment'}
     * @emits 'send-payment-reverse' @payload {'pos.payment'}
     * @emits 'send-force-done' @payload {'pos.payment'}
     */
    class PaymentScreenElectronicPayment extends PosComponent {}
    PaymentScreenElectronicPayment.template = 'PaymentScreenElectronicPayment';

    return PaymentScreenElectronicPayment;
});
