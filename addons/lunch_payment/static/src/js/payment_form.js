odoo.define('lunch_payment.payment_form', function (require) {
"use strict";

var PaymentForm = require('payment.payment_form');

PaymentForm.include({
    _getTxData: function () {
        var result = this._super.apply(this, arguments);
        return _.extend(result, {
            cashmove_id: this.options.cashmoveId,
        });
    },
});

});
