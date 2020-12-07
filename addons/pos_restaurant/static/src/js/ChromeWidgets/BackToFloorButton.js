odoo.define('pos_restaurant.BackToFloorButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class BackToFloorButton extends PosComponent {
        async onClick(currentTable, floor) {
            await this.env.model.onExitTable(currentTable.id);
            await this.env.actionHandler({ name: 'actionSetFloor', args: [floor] });
        }
    }
    BackToFloorButton.template = 'BackToFloorButton';

    return BackToFloorButton;
});
