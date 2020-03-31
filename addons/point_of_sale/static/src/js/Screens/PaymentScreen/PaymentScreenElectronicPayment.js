odoo.define('point_of_sale.PaymentScreenElectronicPayment', function(require) {
    'use strict';

    const { PosComponent, addComponents } = require('point_of_sale.PosComponent');
    const { PaymentScreenPaymentLines } = require('point_of_sale.PaymentScreenPaymentLines');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class PaymentScreenElectronicPayment extends PosComponent {
        static template = 'PaymentScreenElectronicPayment';
    }

    addComponents(PaymentScreenPaymentLines, [PaymentScreenElectronicPayment]);
    Registry.add('PaymentScreenElectronicPayment', PaymentScreenElectronicPayment);

    return { PaymentScreenElectronicPayment };
});
