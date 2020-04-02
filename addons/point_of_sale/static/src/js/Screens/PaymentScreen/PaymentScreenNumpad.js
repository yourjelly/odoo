odoo.define('point_of_sale.PaymentScreenNumpad', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class PaymentScreenNumpad extends PosComponent {
        static template = 'PaymentScreenNumpad';
        constructor() {
            super(...arguments);
            this.decimalPoint = this.env._t.database.parameters.decimal_point;
        }
    }

    Registry.add(PaymentScreenNumpad);

    return PaymentScreenNumpad;
});
