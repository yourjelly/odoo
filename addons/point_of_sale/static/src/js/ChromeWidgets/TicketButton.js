odoo.define('point_of_sale.TicketButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class TicketButton extends PosComponent {
        getNumberOfOrders() {
            return this.env.model.getDraftOrders().length;
        }
    }
    TicketButton.template = 'TicketButton';

    return TicketButton;
});
