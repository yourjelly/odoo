odoo.define('pos_restaurant.BackToFloorButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class BackToFloorButton extends PosComponent {
        async onClick(currentTable) {
            await this.env.actionHandler({ name: 'actionExitTable', args: [currentTable] });
        }
    }
    BackToFloorButton.template = 'BackToFloorButton';

    return BackToFloorButton;
});
