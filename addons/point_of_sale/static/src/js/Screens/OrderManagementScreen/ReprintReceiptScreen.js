odoo.define('point_of_sale.ReprintReceiptScreen', function (require) {
    'use strict';

    const AbstractReceiptScreen = require('point_of_sale.AbstractReceiptScreen');
    const OrderReceipt = require('point_of_sale.OrderReceipt');

    class ReprintReceiptScreen extends AbstractReceiptScreen {
        confirm() {
            this.props.resolve();
            this.trigger('close-temp-screen');
        }
        tryReprint() {
            this.printReceipt();
        }
    }
    ReprintReceiptScreen.template = 'ReprintReceiptScreen';
    ReprintReceiptScreen.components = { OrderReceipt };

    return ReprintReceiptScreen;
});
