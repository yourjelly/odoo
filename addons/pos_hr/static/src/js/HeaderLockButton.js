odoo.define('point_of_sale.HeaderLockButton', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registry = require('point_of_sale.ComponentsRegistry');
    const { useState } = owl;

    class HeaderLockButton extends PosComponent {
        state = useState({ isUnlockIcon: true, title: 'Unlocked' });
        async showLoginScreen() {
            await this.showTempScreen('LoginScreen');
        }
        onMouseOver(isMouseOver) {
            this.state.isUnlockIcon = !isMouseOver;
            this.state.title = isMouseOver ? 'Lock' : 'Unlocked';
        }
    }

    Chrome.addComponents([HeaderLockButton]);
    Registry.add(HeaderLockButton);

    return HeaderLockButton;
});
