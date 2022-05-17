odoo.define('point_of_sale.TicketButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class TicketButton extends PosComponent {
        static props = {
            orderCount: Number,
            isTicketScreenShown: Boolean,
        }
        onClick() {
            if (this.props.isTicketScreenShown) {
                this.env.posbus.trigger('ticket-button-clicked');
            } else {
                this.showScreen('TicketScreen');
            }
        }
    }
    TicketButton.template = 'TicketButton';

    Registries.Component.add(TicketButton);

    return TicketButton;
});
