odoo.define('pos_restaurant.BillScreen', function(require) {
    'use strict';

    const { addComponents } = require('point_of_sale.PosComponent');
    const { Chrome } = require('point_of_sale.chrome');
    const Registry = require('point_of_sale.ComponentsRegistry');

    const BillScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'BillScreen';
            confirm() {
                this.props.resolve({ confirmed: true, payload: null });
                this.trigger('close-temp-screen');
            }
        };

    addComponents(Chrome, ['BillScreen']);
    Registry.addByExtending('BillScreen', 'ReceiptScreen', BillScreen);
});
