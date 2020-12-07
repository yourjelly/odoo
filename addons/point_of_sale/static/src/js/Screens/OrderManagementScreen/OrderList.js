odoo.define('point_of_sale.OrderList', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    /**
     * @props {'pos.order'[]} orders
     */
    class OrderList extends PosComponent {
        isHighlighted(order) {
            return order.id === this.env.model.data.uiState.OrderManagementScreen.activeOrderId;
        }
    }
    OrderList.template = 'OrderList';

    return OrderList;
});
