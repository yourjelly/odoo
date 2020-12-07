odoo.define('point_of_sale.CashierName', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    // Previously UsernameWidget
    class CashierName extends PosComponent {}
    CashierName.template = 'CashierName';

    return CashierName;
});
