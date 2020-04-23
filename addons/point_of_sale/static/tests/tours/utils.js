odoo.define('point_of_sale.tour.utils', function (require) {
    'use strict';

    let steps = [];

    function startSteps() {
        steps = [];
    }

    function getSteps() {
        return steps;
    }

    class ProductScreenMethods {
        clickDisplayedProduct(name) {
            return [
                {
                    content: `click product '${name}'`,
                    trigger: `.product-list .product-name:contains("${name}")`,
                },
            ];
        }

        selectedOrderlineHas(name, quantity, price) {
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

        selectOrderline(name, quantity) {
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

        pressNumpadDigit(key) {
            return [
                {
                    content: `'${key}' pressed in numpad`,
                    trigger: `.numpad .number-char:contains("${key}")`,
                },
            ];
        }

        pressNumpadMode(mode) {
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

        pressNumpadBackspace() {
            return [
                {
                    content: `'Backspace' pressed in numpad`,
                    trigger: `.numpad .input-button.numpad-backspace`,
                },
            ];
        }

        pressNumpadMinus() {
            return [
                {
                    content: `'+/-' pressed in numpad`,
                    trigger: `.numpad .input-button.numpad-minus`,
                },
            ];
        }

        checkOrderIsEmpty() {
            return [
                {
                    content: `order is empty`,
                    trigger: `.order .order-empty`,
                    run: () => {},
                },
            ];
        }

        clickSubcategory(name) {
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

        clickHomeCategory() {
            return [
                {
                    content: `click Home subcategory`,
                    trigger: `.breadcrumbs .breadcrumb-home`,
                },
            ];
        }

        checkProductDisplayed(name) {
            return [
                {
                    content: `'${name}' should be displayed`,
                    trigger: `.product-list .product-name:contains("${name}")`,
                    run: () => {},
                },
            ];
        }

        clickPayButton() {
            return [
                { content: 'click pay button', trigger: '.actionpad .button.pay' },
                {
                    content: 'now in payment screen',
                    trigger: '.pos-content .payment-screen',
                    run: () => {},
                },
            ];
        }
    }

    // this is the method decorator
    // when the method is called, the generated steps are added
    // to steps
    const methodProxyHandler = {
        apply(target, thisArg, args) {
            const res = target.call(thisArg, ...args);
            // This step is added before the real steps.
            // Very useful when debugging because we know which
            // method call failed and what were the parameters.
            steps.push({
                content: `DOING "${target.name}(${args.map(a => `'${a}'`).join(", ")})"`,
                trigger: '.pos',
                run: () => {},
            });
            steps.push(...res);
            return res;
        },
    };

    // we proxy get of the method to decorate the method call
    const proxyHandler = {
        get(target, key) {
            return new Proxy(target[key], methodProxyHandler);
        },
    };

    return {
        ProductScreenMethods: new Proxy(new ProductScreenMethods(), proxyHandler),
        startSteps,
        getSteps,
    };
});
