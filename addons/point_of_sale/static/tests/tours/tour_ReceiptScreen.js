odoo.define('point_of_sale.tour.ReceiptScreen', function (require) {
    'use strict';

    const {
        ProductScreenMethods: ProductScreen,
        PaymentScreenMethods: PaymentScreen,
        ReceiptScreenMethods: ReceiptScreen,
        getSteps,
        startSteps,
    } = require('point_of_sale.tour.utils');
    var Tour = require('web_tour.tour');

    startSteps();

    // pay exact amount
    ProductScreen.order('Letter Tray', '10');
    ProductScreen.clickPayButton();
    PaymentScreen.clickPaymentMethod('Bank');
    PaymentScreen.validatePayment();
    ReceiptScreen.checkReceipt();
    ReceiptScreen.checkChange('0.00');
    ReceiptScreen.nextScreen();

    // pay more than total price
    ProductScreen.clickHomeCategory();
    ProductScreen.order('Desk Pad', '6', '5.0');
    ProductScreen.order('Whiteboard Pen', '6', '6.1');
    ProductScreen.order('Monitor Stand', '6', '1.3');
    ProductScreen.clickPayButton();
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.pressNumpad('8 0 0')
    PaymentScreen.validatePayment();
    ReceiptScreen.checkReceipt();
    ReceiptScreen.checkChange('725.6');
    ReceiptScreen.nextScreen();

    Tour.register('tour_ReceiptScreen', { test: true, url: '/pos/web' }, getSteps());
});
