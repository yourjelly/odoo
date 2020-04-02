odoo.define('point_of_sale.CashierName', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registry = require('point_of_sale.ComponentsRegistry');

    // Previously UsernameWidget
    class CashierName extends PosComponent {
        static template = 'CashierName';
        get username() {
            const cashier = this.env.pos.get_cashier();
            if (cashier) {
                return cashier.name;
            } else {
                return '';
            }
        }
    }

    Registry.add(CashierName);

    return CashierName;
});
