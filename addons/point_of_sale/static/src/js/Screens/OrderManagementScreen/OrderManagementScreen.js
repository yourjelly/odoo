odoo.define('point_of_sale.OrderManagementScreen', function (require) {
    'use strict';

    const AbstractOrderManagementScreen = require('point_of_sale.AbstractOrderManagementScreen');
    const OrderDetails = require('point_of_sale.OrderDetails');
    const OrderManagementControlPanel = require('point_of_sale.OrderManagementControlPanel');
    const OrderList = require('point_of_sale.OrderList');
    const InvoiceButton = require('point_of_sale.InvoiceButton');
    const ReprintReceiptButton = require('point_of_sale.ReprintReceiptButton');
    const ActionpadWidget = require('point_of_sale.ActionpadWidget');
    const NumpadWidget = require('point_of_sale.NumpadWidget');
    const MobileOrderManagementScreen = require('point_of_sale.MobileOrderManagementScreen');

    class OrderManagementScreen extends AbstractOrderManagementScreen {
        static components = {
            OrderDetails,
            OrderManagementControlPanel,
            OrderList,
            InvoiceButton,
            ReprintReceiptButton,
            ActionpadWidget,
            NumpadWidget,
            MobileOrderManagementScreen,
        };
        willUnmount() {
            // We are doing this so that the next time this screen is rendered
            // ordersToShow won't contain deleted activeOrders.
            this.env.model.orderFetcher.ordersToShow = [];
        }
    }
    OrderManagementScreen.template = 'OrderManagementScreen';

    return OrderManagementScreen;
});
