odoo.define('point_of_sale.PaymentMethodButton', function(require) {
    'use strict';

    const { PosComponent, addComponents } = require('point_of_sale.PosComponent');
    const { PaymentScreen } = require('point_of_sale.PaymentScreen');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class PaymentMethodButton extends PosComponent {
        static template = 'PaymentMethodButton';
    }

    addComponents(PaymentScreen, [PaymentMethodButton]);
    Registry.add('PaymentMethodButton', PaymentMethodButton);

    return { PaymentMethodButton };
});
