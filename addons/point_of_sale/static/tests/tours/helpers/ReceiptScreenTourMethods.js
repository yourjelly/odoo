odoo.define('point_of_sale.tour.ReceiptScreenTourMethods', function (require) {
    'use strict';

    const { createTourMethods } = require('point_of_sale.tour.utils');

    class Do {
        clickNextOrder() {
            return [
                {
                    content: 'go to next screen',
                    trigger: '.receipt-screen .button.next.highlight',
                },
            ];
        }
    }

    class Check {
        receiptIsThere() {
            return [
                {
                    content: 'there should be the receipt',
                    trigger: '.receipt-screen .pos-receipt',
                    run: () => {},
                },
            ];
        }

        changeIs(amount) {
            return [
                {
                    content: `change amount should be ${amount}`,
                    trigger: `.receipt-screen .change-value:contains("${amount}")`,
                    run: () => {},
                },
            ];
        }
    }

    return {
        Do,
        Check,
        ReceiptScreen: createTourMethods('ReceiptScreen', Do, Check),
    };
});
