odoo.define('pos_restaurant.BillScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const Registries = require('point_of_sale.Registries');

    const BillScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'BillScreen';
            confirm() {
                this.props.resolve({ confirmed: true, payload: null });
                this.trigger('close-temp-screen');
            }
        };

    Registries.Component.addByExtending(BillScreen, ReceiptScreen);

    return BillScreen;
});
