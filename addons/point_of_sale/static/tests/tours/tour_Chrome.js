odoo.define('point_of_sale.tour.Chrome', function (require) {
    'use strict';

    const {
        ProductScreenMethods: ProductScreen,
        PaymentScreenMethods: PaymentScreen,
        ReceiptScreenMethods: ReceiptScreen,
        ChromeMethods: Chrome,
        getSteps,
        startSteps,
    } = require('point_of_sale.tour.utils');
    var Tour = require('web_tour.tour');

    startSteps();

    // Order 1 is at Product Screen
    ProductScreen.clickHomeCategory();
    ProductScreen.order('Desk Pad', '1', '2');

    // Order 2 is at Payment Screen
    Chrome.newOrder();
    ProductScreen.order('Monitor Stand', '3', '4');
    ProductScreen.clickPayButton();

    // Order 3 is at Receipt Screen
    Chrome.newOrder();
    ProductScreen.order('Whiteboard Pen', '5', '6');
    ProductScreen.clickPayButton();
    PaymentScreen.clickPaymentMethod('Bank');
    PaymentScreen.validatePayment();

    // Select order 1, should be at Product Screen
    Chrome.selectOrder('1');
    ProductScreen.selectedOrderlineHas('Desk Pad', '1.0', '2.0');

    // Select order 2, should be at Payment Screen
    Chrome.selectOrder('2');
    PaymentScreen.checkEmptyPaymentlines('12.0');
    PaymentScreen.checkValidate(false);

    // Select order 3, should be at Receipt Screen
    Chrome.selectOrder('3');
    ReceiptScreen.checkChange('0.0');

    // Pay order 1, with change
    Chrome.selectOrder('1');
    ProductScreen.clickPayButton();
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.pressNumpad('2 0');
    PaymentScreen.validatePayment();
    ReceiptScreen.checkChange('18.0');

    // Select order 3, should still be at Receipt Screen
    // but change should be different.
    Chrome.selectOrder('3');
    ReceiptScreen.checkChange('0.0');

    // click next screen on order 3
    // then delete the new empty order
    ReceiptScreen.nextScreen();
    ProductScreen.checkOrderIsEmpty();
    Chrome.deleteOrder();

    // Order 2 should be the current order
    // Deleting it should open a popup, confirm it.
    Chrome.deleteOrder();
    Chrome.confirmPopup();

    // Now left with order 1 in payment screen
    // go next screen
    ReceiptScreen.nextScreen();

    Tour.register('tour_Chrome', { test: true, url: '/pos/web' }, getSteps());
});
