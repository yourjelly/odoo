odoo.define('point_of_sale.MobileOrderManagementScreen', function (require) {
    'use strict';

    const AbstractOrderManagementScreen = require('point_of_sale.AbstractOrderManagementScreen');
    const OrderDetails = require('point_of_sale.OrderDetails');
    const OrderManagementControlPanel = require('point_of_sale.OrderManagementControlPanel');
    const OrderList = require('point_of_sale.OrderList');
    const InvoiceButton = require('point_of_sale.InvoiceButton');
    const ReprintReceiptButton = require('point_of_sale.ReprintReceiptButton');
    const ActionpadWidget = require('point_of_sale.ActionpadWidget');
    const NumpadWidget = require('point_of_sale.NumpadWidget');
    const { useState } = owl.hooks;

    class MobileOrderManagementScreen extends AbstractOrderManagementScreen {
        static components = {
            OrderDetails,
            OrderManagementControlPanel,
            OrderList,
            InvoiceButton,
            ReprintReceiptButton,
            ActionpadWidget,
            NumpadWidget,
        };
        constructor() {
            super(...arguments);
            this.mobileState = useState({ showDetails: false });
        }
        async _onClickOrder() {
            this.mobileState.showDetails = true;
            await super._onClickOrder(...arguments);
        }
    }
    MobileOrderManagementScreen.template = 'MobileOrderManagementScreen';

    return MobileOrderManagementScreen;
});
