odoo.define('pos_restaurant.BillScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const Chrome = require('point_of_sale.Chrome');
    const Registry = require('point_of_sale.ComponentsRegistry');

    const BillScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'BillScreen';
            confirm() {
                this.props.resolve({ confirmed: true, payload: null });
                this.trigger('close-temp-screen');
            }
        };

    // we pass string array to addComponents because 'BillScreen' is
    // a Class inside the Registry. The concrete class of 'BillScreen'
    // is yet to be available.
    Chrome.addComponents(['BillScreen']);
    Registry.addByExtending(BillScreen, ReceiptScreen);

    return BillScreen;
});
