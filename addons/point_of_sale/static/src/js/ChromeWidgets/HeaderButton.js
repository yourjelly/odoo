odoo.define('point_of_sale.HeaderButton', function(require) {
    'use strict';

    const { useState } = owl;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registry = require('point_of_sale.ComponentsRegistry');

    // Previously HeaderButtonWidget
    // This is the close session button
    class HeaderButton extends PosComponent {
        static template = 'HeaderButton';
        constructor() {
            super(...arguments);
            this.state = useState({ label: 'Close' });
            this.confirmed = null;
        }
        get translatedLabel() {
            return this.env._t(this.state.label);
        }
        onClick() {
            if (!this.confirmed) {
                this.state.label = 'Confirm';
                this.confirmed = setTimeout(() => {
                    this.state.label = 'Close';
                    this.confirmed = null;
                }, 2000);
            } else {
                this.trigger('close-pos');
            }
        }
    }

    Registry.add(HeaderButton);

    return HeaderButton;
});
