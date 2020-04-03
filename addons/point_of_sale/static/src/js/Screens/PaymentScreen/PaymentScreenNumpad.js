odoo.define('point_of_sale.PaymentScreenNumpad', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class PaymentScreenNumpad extends PosComponent {
        static template = 'PaymentScreenNumpad';
        constructor() {
            super(...arguments);
            this.decimalPoint = this.env._t.database.parameters.decimal_point;
        }
    }

    Registries.Component.add(PaymentScreenNumpad);

    return PaymentScreenNumpad;
});
