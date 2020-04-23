odoo.define('point_of_sale.tour.PaymentScreen', function (require) {
    'use strict';

    const {
        ProductScreenMethods: ProductScreen,
        PaymentScreenMethods: PaymentScreen,
        getSteps,
        startSteps,
    } = require('point_of_sale.tour.utils');
    var Tour = require('web_tour.tour');

    startSteps();

    ProductScreen.order('Letter Tray', '10');
    ProductScreen.clickPayButton();
    PaymentScreen.checkEmptyPaymentlines('52.8');

    // Pay with cash, created line should have zero amount
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.checkSelectedPaymentline('Cash', '0.00');
    PaymentScreen.pressNumpad('1 1');
    PaymentScreen.checkSelectedPaymentline('Cash', '11.00');
    PaymentScreen.checkRemaining('41.8');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(false);
    // remove the selected paymentline with multiple backspace presses
    PaymentScreen.pressNumpad('Backspace Backspace Backspace');
    PaymentScreen.checkEmptyPaymentlines('52.8');

    // Pay with bank, the selected line should have full amount
    PaymentScreen.clickPaymentMethod('Bank');
    PaymentScreen.checkRemaining('0.0');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(true);
    // remove the line using the delete button
    PaymentScreen.deletePaymentline('Bank', '52.8');

    // Use +10 and +50 to increment the amount of the paymentline
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.pressNumpad('+10');
    PaymentScreen.checkRemaining('42.8');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(false);
    PaymentScreen.pressNumpad('+50');
    PaymentScreen.checkRemaining('0.0');
    PaymentScreen.checkChange('7.2');
    PaymentScreen.checkValidate(true);
    PaymentScreen.deletePaymentline('Cash', '60.0');

    // Multiple paymentlines
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.pressNumpad('1');
    PaymentScreen.checkRemaining('51.8');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(false);
    PaymentScreen.clickPaymentMethod('Cash');
    PaymentScreen.pressNumpad('5');
    PaymentScreen.checkRemaining('46.8');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(false);
    PaymentScreen.clickPaymentMethod('Bank');
    PaymentScreen.pressNumpad('2 0');
    PaymentScreen.checkRemaining('26.8');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(false);
    PaymentScreen.clickPaymentMethod('Bank');
    PaymentScreen.checkRemaining('0.0');
    PaymentScreen.checkChange('0.0');
    PaymentScreen.checkValidate(true);

    // toggle email button
    PaymentScreen.toggleEmail();
    PaymentScreen.checkEmailButton(true);
    PaymentScreen.toggleEmail();
    PaymentScreen.checkEmailButton(false);

    Tour.register('tour_PaymentScreen', { test: true, url: '/pos/web' }, getSteps());
});
