odoo.define('point_of_sale.OrderDetails', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Orderline = require('point_of_sale.Orderline');
    const OrderSummary = require('point_of_sale.OrderSummary');

    /**
     * @props {'pos.order'} order
     */
    class OrderDetails extends PosComponent {
        static components = { Orderline, OrderSummary };
    }
    OrderDetails.template = 'OrderDetails';

    return OrderDetails;
});
