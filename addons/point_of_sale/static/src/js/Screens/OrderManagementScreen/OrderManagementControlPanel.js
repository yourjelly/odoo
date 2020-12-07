odoo.define('point_of_sale.OrderManagementControlPanel', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class OrderManagementControlPanel extends PosComponent {
        get showPageControls() {
            return this.env.model.floatCompare(this.env.model.orderFetcher.lastPage, 1, 5) === 1;
        }
        get pageNumber() {
            const currentPage = this.env.model.orderFetcher.currentPage;
            const lastPage = this.env.model.orderFetcher.lastPage;
            return isNaN(lastPage) ? '' : `(${currentPage}/${lastPage})`;
        }
    }
    OrderManagementControlPanel.template = 'OrderManagementControlPanel';

    return OrderManagementControlPanel;
});
