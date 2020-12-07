odoo.define('point_of_sale.HeaderButton', function (require) {
    'use strict';

    const { useState } = owl;
    const PosComponent = require('point_of_sale.PosComponent');

    class HeaderButton extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ label: this.env._t('Close') });
            this.confirmed = null;
        }
        onClick() {
            if (!this.confirmed) {
                this.state.label = this.env._t('Confirm');
                this.confirmed = setTimeout(() => {
                    this.state.label = this.env._t('Close');
                    this.confirmed = null;
                }, 2000);
            } else {
                this.env.actionHandler({ name: 'actionClosePos' });
            }
        }
    }
    HeaderButton.template = 'HeaderButton';

    return HeaderButton;
});
