odoo.define('point_of_sale.PaymentScreenNumpad', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class PaymentScreenNumpad extends PosComponent {
        static template = 'PaymentScreenNumpad';
        constructor() {
            super(...arguments);
            this.decimalPoint = this.env._t.database.parameters.decimal_point;
        }
    }

    PaymentScreen.addComponents([PaymentScreenNumpad]);
    Registry.add('PaymentScreenNumpad', PaymentScreenNumpad);

    return PaymentScreenNumpad;
});
