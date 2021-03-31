odoo.define('point_of_sale.SwitchViewButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class SwitchViewButton extends PosComponent {
        async onClick() {
            await this.env.actionHandler({ name: 'actionSwitchView' });
        }
    }
    SwitchViewButton.template = 'SwitchViewButton';

    return SwitchViewButton;
});
