odoo.define('pos_reprint.ReprintScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const Chrome = require('point_of_sale.Chrome');
    const Registry = require('point_of_sale.ComponentsRegistry');

    const ReprintScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'ReprintScreen';
            confirm() {
                this.props.resolve();
                this.trigger('close-temp-screen');
            }
        };

    Chrome.addComponents(['ReprintScreen']);
    Registry.addByExtending(ReprintScreen, ReceiptScreen);

    return ReprintScreen;
});
