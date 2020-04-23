odoo.define('point_of_sale.tour.ProductScreen', function (require) {
    'use strict';

    const {
        ProductScreenMethods: ProductScreen,
        getSteps,
        startSteps,
    } = require('point_of_sale.tour.utils');
    var Tour = require('web_tour.tour');

    // signal to start generating steps
    // when finished, steps can be taken from getSteps
    startSteps();

    // Go by default to home category
    ProductScreen.clickHomeCategory()

    // Clicking product multiple times should increment quantity
    ProductScreen.clickDisplayedProduct('Desk Organizer')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '1.0', '5.10')
    ProductScreen.clickDisplayedProduct('Desk Organizer')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '2.0', '10.20')

    // Clicking product should add new orderline and select the orderline
    // If orderline exists, increment the quantity
    ProductScreen.clickDisplayedProduct('Letter Tray')
    ProductScreen.selectedOrderlineHas('Letter Tray', '1.0', '4.80')
    ProductScreen.clickDisplayedProduct('Desk Organizer')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '3.0', '15.30')

    // Check effects of clicking numpad buttons
    ProductScreen.selectOrderline('Letter Tray', '1')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectedOrderlineHas('Letter Tray', '0.0', '0.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '3', '15.30')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '0.0', '0.0')
    ProductScreen.pressNumpad('1')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '1.0', '5.1')
    ProductScreen.pressNumpad('2')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '12.0', '61.2')
    ProductScreen.pressNumpad('3')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.0', '627.3')
    ProductScreen.pressNumpad('.')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.0', '627.3')
    ProductScreen.pressNumpad('5')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.5', '629.85')
    ProductScreen.pressNumpad('Price')
    ProductScreen.pressNumpad('1')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.5', '123.5')
    ProductScreen.pressNumpad('1')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.5', '1,358.5')
    ProductScreen.pressNumpad('Disc')
    ProductScreen.pressNumpad('5')
    ProductScreen.selectedOrderlineHas('Desk Organizer', '123.5', '1,290.58')
    ProductScreen.pressNumpad('Qty')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.checkOrderIsEmpty()

    // Check different subcategories
    ProductScreen.clickSubcategory('Desks')
    ProductScreen.checkProductDisplayed('Desk Pad')
    ProductScreen.clickHomeCategory()
    ProductScreen.clickSubcategory('Miscellaneous')
    ProductScreen.checkProductDisplayed('Whiteboard Pen')
    ProductScreen.clickHomeCategory()
    ProductScreen.clickSubcategory('Chairs')
    ProductScreen.checkProductDisplayed('Letter Tray')
    ProductScreen.clickHomeCategory()

    // Add multiple orderlines then delete each of them until emp
    ProductScreen.clickDisplayedProduct('Whiteboard Pen')
    ProductScreen.clickDisplayedProduct('Wall Shelf Unit')
    ProductScreen.clickDisplayedProduct('Small Shelf')
    ProductScreen.clickDisplayedProduct('Magnetic Board')
    ProductScreen.clickDisplayedProduct('Monitor Stand')
    ProductScreen.selectOrderline('Whiteboard Pen', '1.0')
    ProductScreen.selectedOrderlineHas('Whiteboard Pen', '1.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectOrderline('Wall Shelf Unit', '1.0')
    ProductScreen.selectedOrderlineHas('Wall Shelf Unit', '1.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectOrderline('Small Shelf', '1.0')
    ProductScreen.selectedOrderlineHas('Small Shelf', '1.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.selectOrderline('Magnetic Board', '1.0')
    ProductScreen.selectedOrderlineHas('Magnetic Board', '1.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    // Monitor Stand should be automatically selected at this poi
    ProductScreen.selectedOrderlineHas('Monitor Stand', '1.0')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.pressNumpad('Backspace')
    ProductScreen.checkOrderIsEmpty()

    Tour.register('tour_ProductScreen', { test: true, url: '/pos/web' }, getSteps());
});
