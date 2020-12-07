odoo.define('pos_restaurant.TransferOrderButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require('web.custom_hooks');

    class TransferOrderButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        async onClick() {
            await this.env.actionHandler({ name: 'actionTransferOrder', args: [this.props.activeOrder] });
        }
    }
    TransferOrderButton.template = 'TransferOrderButton';

    return TransferOrderButton;
});
