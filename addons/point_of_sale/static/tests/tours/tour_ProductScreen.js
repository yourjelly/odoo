odoo.define('point_of_sale.tour.ProductScreen', function (require) {
    'use strict';

    var Tour = require('web_tour.tour');

    function clickDisplayedProduct(name) {
        return [
            {
                content: `click product '${name}'`,
                trigger: `.product-list .product-name:contains("${name}")`,
            },
        ];
    }

    function selectedOrderlineHas(name, quantity, price) {
        const res = [
            {
                content: `'${name}' is selected`,
                trigger: `.order .orderline.selected .product-name:contains("${name}")`,
                run: function () {}, // it's a check
            },
        ];
        if (quantity) {
            res.push({
                content: `selected line has ${quantity} quantity`,
                trigger: `.order .orderline.selected .product-name:contains("${name}") ~ .info-list em:contains("${quantity}")`,
                run: function () {}, // it's a check
            });
        }
        if (price) {
            res.push({
                content: `selected line has total price of ${price}`,
                trigger: `.order .orderline.selected .product-name:contains("${name}") ~ .price:contains("${price}")`,
                run: function () {}, // it's a check
            });
        }
        return res;
    }

    function selectOrderline(name, quantity) {
        return [
            {
                content: `selecting orderline with product '${name}' and quantity '${quantity}'`,
                trigger: `.order .orderline:not(:has(.selected)) .product-name:contains("${name}") ~ .info-list em:contains("${quantity}")`,
            },
            {
                content: `orderline with product '${name}' and quantity '${quantity}' has been selected`,
                trigger: `.order .orderline.selected .product-name:contains("${name}") ~ .info-list em:contains("${quantity}")`,
                run: () => {},
            },
        ];
    }

    function pressNumpadDigit(key) {
        return [
            {
                content: `'${key}' pressed in numpad`,
                trigger: `.numpad .number-char:contains("${key}")`,
            },
        ];
    }

    function pressNumpadMode(mode) {
        return [
            {
                content: `'${mode}' mode pressed in numpad`,
                trigger: `.numpad .mode-button:contains("${mode}")`,
            },
            {
                content: `'${mode}' mode is selected`,
                trigger: `.numpad .mode-button.selected-mode:contains("${mode}")`,
                run: () => {},
            },
        ];
    }

    function pressNumpadBackspace() {
        return [
            {
                content: `'Backspace' pressed in numpad`,
                trigger: `.numpad .input-button.numpad-backspace`,
            },
        ];
    }

    function pressNumpadMinus() {
        return [
            {
                content: `'+/-' pressed in numpad`,
                trigger: `.numpad .input-button.numpad-minus`,
            },
        ];
    }

    function checkOrderIsEmpty() {
        return [
            {
                content: `order is empty`,
                trigger: `.order .order-empty`,
                run: () => {},
            },
        ];
    }

    function clickSubcategory(name) {
        return [
            {
                content: `selecting '${name}' subcategory`,
                trigger: `.category-list .category-simple-button:contains("${name}")`,
            },
            {
                content: `'${name}' subcategory selected`,
                trigger: `.breadcrumbs .breadcrumb-button:contains("${name}")`,
                run: () => {},
            },
        ];
    }

    function clickHomeCategory() {
        return [
            {
                content: `click Home subcategory`,
                trigger: `.breadcrumbs .breadcrumb-home`,
            },
        ];
    }

    function checkProductDisplayed(name) {
        return [
            {
                content: `'${name}' should be displayed`,
                trigger: `.product-list .product-name:contains("${name}")`,
                run: () => {},
            },
        ];
    }

    var steps = [
        {
            content: 'waiting for loading to finish',
            trigger: 'body:not(:has(.loader))',
            run: function () {}, // it's a check
        },
        {
            // Leave category displayed by default
            content: 'click category switch',
            trigger: '.breadcrumb-home',
            run: 'click',
        },
    ];

    // Clicking product multiple times should increment quantity
    steps = steps.concat(clickDisplayedProduct('Desk Organizer'));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '1.0', '5.10'));
    steps = steps.concat(clickDisplayedProduct('Desk Organizer'));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '2.0', '10.20'));

    // Clicking product should add new orderline and select the orderline
    // If orderline exists, increment the quantity
    steps = steps.concat(clickDisplayedProduct('Letter Tray'));
    steps = steps.concat(selectedOrderlineHas('Letter Tray', '1.0', '4.80'));
    steps = steps.concat(clickDisplayedProduct('Desk Organizer'));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '3.0', '15.30'));

    // Check effects of clicking numpad buttons
    steps = steps.concat(selectOrderline('Letter Tray', '1'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectedOrderlineHas('Letter Tray', '0.0', '0.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '3', '15.30'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '0.0', '0.0'));
    steps = steps.concat(pressNumpadDigit(1));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '1.0', '5.1'));
    steps = steps.concat(pressNumpadDigit(2));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '12.0', '61.2'));
    steps = steps.concat(pressNumpadDigit(3));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.0', '627.3'));
    steps = steps.concat(pressNumpadDigit('.'));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.0', '627.3'));
    steps = steps.concat(pressNumpadDigit(5));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.5', '629.85'));
    steps = steps.concat(pressNumpadMode('Price'));
    steps = steps.concat(pressNumpadDigit(1));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.5', '123.5'));
    steps = steps.concat(pressNumpadDigit(1));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.5', '1,358.5'));
    steps = steps.concat(pressNumpadMode('Disc'));
    steps = steps.concat(pressNumpadDigit(5));
    steps = steps.concat(selectedOrderlineHas('Desk Organizer', '123.5', '1,290.58'));
    steps = steps.concat(pressNumpadMode('Qty'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(checkOrderIsEmpty());

    // Check different subcategories
    steps = steps.concat(clickSubcategory('Desks'));
    steps = steps.concat(checkProductDisplayed('Desk Pad'));
    steps = steps.concat(clickHomeCategory());
    steps = steps.concat(clickSubcategory('Miscellaneous'));
    steps = steps.concat(checkProductDisplayed('Whiteboard Pen'));
    steps = steps.concat(clickHomeCategory());
    steps = steps.concat(clickSubcategory('Chairs'));
    steps = steps.concat(checkProductDisplayed('Letter Tray'));
    steps = steps.concat(clickHomeCategory());

    // Add multiple orderlines then delete each of them until empty
    steps = steps.concat(clickDisplayedProduct('Whiteboard Pen'));
    steps = steps.concat(clickDisplayedProduct('Wall Shelf Unit'));
    steps = steps.concat(clickDisplayedProduct('Small Shelf'));
    steps = steps.concat(clickDisplayedProduct('Magnetic Board'));
    steps = steps.concat(clickDisplayedProduct('Monitor Stand'));
    steps = steps.concat(selectOrderline('Whiteboard Pen', '1.0'));
    steps = steps.concat(selectedOrderlineHas('Whiteboard Pen', '1.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectOrderline('Wall Shelf Unit', '1.0'));
    steps = steps.concat(selectedOrderlineHas('Wall Shelf Unit', '1.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectOrderline('Small Shelf', '1.0'));
    steps = steps.concat(selectedOrderlineHas('Small Shelf', '1.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(selectOrderline('Magnetic Board', '1.0'));
    steps = steps.concat(selectedOrderlineHas('Magnetic Board', '1.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    // Monitor Stand should be automatically selected at this point
    steps = steps.concat(selectedOrderlineHas('Monitor Stand', '1.0'));
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(pressNumpadBackspace());
    steps = steps.concat(checkOrderIsEmpty());

    steps = steps.concat([
        {
            content: 'close the Point of Sale frontend',
            trigger: '.header-button',
        },
        {
            content: 'confirm closing the frontend',
            trigger: '.header-button.confirm',
            run: function () {}, //it's a check,
        },
    ]);

    Tour.register('tour_ProductScreen', { test: true, url: '/pos/web' }, steps);
});
