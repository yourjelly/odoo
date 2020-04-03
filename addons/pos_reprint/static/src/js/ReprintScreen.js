odoo.define('pos_reprint.ReprintScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const Registries = require('point_of_sale.Registries');

    const ReprintScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            static template = 'ReprintScreen';
            confirm() {
                this.props.resolve();
                this.trigger('close-temp-screen');
            }
        };

    Registries.Component.addByExtending(ReprintScreen, ReceiptScreen);

    return ReprintScreen;
});
