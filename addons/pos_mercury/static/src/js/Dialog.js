odoo.define('pos_mercury.Dialog', function (require) {
    'use strict';

    const Dialog = require('point_of_sale.Dialog');
    const PaymentTransactionPopup = require('pos_mercury.PaymentTransactionPopup');
    const { patch } = require('web.utils');

    return patch(Dialog, 'pos_mercury', {
        components: { ...Dialog.components, PaymentTransactionPopup },
    });
});
