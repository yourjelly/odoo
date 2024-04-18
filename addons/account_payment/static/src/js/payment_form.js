/** @odoo-module **/

import PaymentForm from '@payment/js/payment_form';
PaymentForm.include({
    _prepareTransactionRouteParams() {
        let invoice_ids = this.paymentContext['invoiceIds'];
        let payment_reference = this.paymentContext['paymentReference'];
        let payment_transaction_params = {};
        if (invoice_ids) {
            payment_transaction_params = { invoice_ids: JSON.parse(invoice_ids), payment_reference };
        }

        return {
            ...this._super(...arguments),
            ...payment_transaction_params,
        };
    },
});
