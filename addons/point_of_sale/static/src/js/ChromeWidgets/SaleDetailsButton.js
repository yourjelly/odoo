odoo.define('point_of_sale.SaleDetailsButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class SaleDetailsButton extends PosComponent {
        async onClick() {
            this.env.actionHandler({ name: 'actionPrintSalesDetails' });
        }
    }
    SaleDetailsButton.template = 'SaleDetailsButton';

    return SaleDetailsButton;
});
