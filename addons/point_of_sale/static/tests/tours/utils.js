odoo.define('point_of_sale.tour.utils', function (require) {
    'use strict';

    const config = require('web.config');
    let steps = [];

    function startSteps() {
        // always start by waiting for loading to finish
        steps = [
            {
                content: 'wait for loading to finish',
                trigger: 'body:not(:has(.loader))',
                run: function () {},
            },
        ];
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

        /**
         * Press the numpad in sequence based on the given space-separated keys.
         * @param {String} keys space-separated numpad keys
         */
        pressNumpad(keys) {
            const numberChars = '. 0 1 2 3 4 5 6 7 8 9'.split(' ');
            const modeButtons = 'Qty Price Disc'.split(' ');
            function generateStep(key) {
                let trigger;
                if (numberChars.includes(key)) {
                    trigger = `.numpad .number-char:contains("${key}")`;
                } else if (modeButtons.includes(key)) {
                    trigger = `.numpad .mode-button:contains("${key}")`;
                } else if (key === 'Backspace') {
                    trigger = `.numpad .numpad-backspace`;
                } else if (key === '+/-') {
                    trigger = `.numpad .numpad-minus`;
                }
                return {
                    content: `'${key}' pressed in product screen numpad`,
                    trigger,
                };
            }
            return keys.split(' ').map(generateStep);
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

        order(productName, quantity, price) {
            const res = this.clickDisplayedProduct(productName);
            if (price) {
                res.push(...this.pressNumpad('Price'));
                res.push(...this.pressNumpad(price.toString().split('').join(' ')));
                res.push(...this.pressNumpad('Qty'));
            }
            for (let char of quantity.toString()) {
                if ('.0123456789'.includes(char)) {
                    res.push(...this.pressNumpad(char));
                } else if ('-'.includes(char)) {
                    res.push(...this.pressNumpad('+/-'));
                }
            }
            return res;
        }
    }

    class PaymentScreenMethods {
        clickPaymentMethod(name) {
            return [
                {
                    content: `click '${name}' payment method`,
                    trigger: `.paymentmethods .button.paymentmethod:contains("${name}")`,
                },
            ];
        }

        /**
         * Check if the paymentlines are empty. Also provide the amount to pay.
         * @param {String} amountToPay
         */
        checkEmptyPaymentlines(amountToPay) {
            return [
                {
                    content: `there are no paymentlines`,
                    trigger: `.paymentlines-empty`,
                    run: () => {},
                },
                {
                    content: `amount to pay is '${amountToPay}'`,
                    trigger: `.paymentlines-empty .total:contains("${amountToPay}")`,
                    run: () => {},
                },
            ];
        }

        /**
         * Check if the selected paymentline has the given payment method and amount.
         * @param {String} paymentMethodName
         * @param {String} amount
         */
        checkSelectedPaymentline(paymentMethodName, amount) {
            return [
                {
                    content: `line paid via '${paymentMethodName}' is selected`,
                    trigger: `.paymentlines .paymentline.selected .col-name:contains("${paymentMethodName}")`,
                    run: () => {},
                },
                {
                    content: `amount tendered in the line is '${amount}'`,
                    trigger: `.paymentlines .paymentline.selected .col-tendered:contains("${amount}")`,
                    run: () => {},
                },
            ];
        }

        /**
         * Check if the remaining is the provided amount.
         * @param {String} amount
         */
        checkRemaining(amount) {
            return [
                {
                    content: `remaining amount is ${amount}`,
                    trigger: `.payment-status-remaining .amount:contains("${amount}")`,
                    run: () => {},
                },
            ];
        }

        /**
         * Check if change is the provided amount.
         * @param {String} amount
         */
        checkChange(amount) {
            return [
                {
                    content: `change is ${amount}`,
                    trigger: `.payment-status-change .amount:contains("${amount}")`,
                    run: () => {},
                },
            ];
        }

        /**
         * Check if validate button is highlighted.
         * @param {Boolean} isHighlighted
         */
        checkValidate(isHighlighted = true) {
            return [
                {
                    content: `validate button is ${
                        isHighlighted ? 'highlighted' : 'not highligted'
                    }`,
                    trigger: isHighlighted
                        ? `.payment-screen .button.next.highlight`
                        : `.payment-screen .button.next:not(:has(.highlight))`,
                    run: () => {},
                },
            ];
        }

        /**
         * Delete the paymentline having the given payment method name and amount.
         * @param {String} name payment method
         * @param {String} amount
         */
        deletePaymentline(name, amount) {
            return [
                {
                    content: `delete ${name} paymentline with ${amount} amount`,
                    trigger: `.paymentlines .paymentline .col-name:contains("${name}") ~ .delete-button`,
                },
            ];
        }

        /**
         * Press the numpad in sequence based on the given space-separated keys.
         * @param {String} keys space-separated numpad keys
         */
        pressNumpad(keys) {
            const numberChars = '. +/- 0 1 2 3 4 5 6 7 8 9'.split(' ');
            const modeButtons = '+10 +20 +50'.split(' ');
            function generateStep(key) {
                let trigger;
                if (numberChars.includes(key)) {
                    trigger = `.payment-numpad .number-char:contains("${key}")`;
                } else if (modeButtons.includes(key)) {
                    trigger = `.payment-numpad .mode-button:contains("${key}")`;
                } else if (key === 'Backspace') {
                    trigger = `.payment-numpad .number-char img[alt="Backspace"]`;
                }
                return {
                    content: `'${key}' pressed in payment numpad`,
                    trigger,
                };
            }
            return keys.split(' ').map(generateStep);
        }

        toggleEmail() {
            return [
                {
                    content: `click email button`,
                    trigger: `.payment-buttons .js_email`,
                },
            ];
        }

        checkEmailButton(isHighlighted) {
            return [
                {
                    content: `check email button`,
                    trigger: isHighlighted
                        ? `.payment-buttons .js_email.highlight`
                        : `.payment-buttons .js_email:not(:has(.highlight))`,
                    run: () => {},
                },
            ];
        }

        validatePayment() {
            return [
                {
                    content: 'validate payment',
                    trigger: `.payment-screen .button.next.highlight`,
                },
            ];
        }
    }

    class ReceiptScreenMethods {
        checkReceipt() {
            return [
                {
                    content: 'there should be the receipt',
                    trigger: '.receipt-screen .pos-receipt',
                    run: () => {},
                },
            ];
        }
        checkChange(amount) {
            return [
                {
                    content: `change amount should be ${amount}`,
                    trigger: `.receipt-screen .change-value:contains("${amount}")`,
                    run: () => {},
                },
            ];
        }
        nextScreen() {
            return [
                {
                    content: 'go to next screen',
                    trigger: '.receipt-screen .button.next.highlight',
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
            if (config.isDebug()) {
                // This step is added before the real steps.
                // Very useful when debugging because we know which
                // method call failed and what were the parameters.
                const constructor = thisArg.constructor.name.split(' ')[1];
                const methodName = target.name.split(' ')[1];
                const argList = args
                    .map((a) => (typeof a === 'string' ? `'${a}'` : `${a}`))
                    .join(', ');
                steps.push({
                    content: `DOING "${constructor}.${methodName}(${argList})"`,
                    trigger: '.pos',
                    run: () => {},
                });
            }
            steps.push(...res);
            return res;
        },
    };

    // we proxy get of the method to decorate the method call
    const proxyHandler = {
        get(target, key) {
            return new Proxy(target[key].bind(target), methodProxyHandler);
        },
    };

    return {
        ProductScreenMethods: new Proxy(new ProductScreenMethods(), proxyHandler),
        PaymentScreenMethods: new Proxy(new PaymentScreenMethods(), proxyHandler),
        ReceiptScreenMethods: new Proxy(new ReceiptScreenMethods(), proxyHandler),
        startSteps,
        getSteps,
    };
});
