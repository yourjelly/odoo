odoo.define('point_of_sale.OrderSummary', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class OrderSummary extends PosComponent {}
    OrderSummary.template = 'OrderSummary';

    return OrderSummary;
});
