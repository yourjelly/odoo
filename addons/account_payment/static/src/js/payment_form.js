/** @odoo-module **/

import PaymentForm from '@payment/js/payment_form';

PaymentForm.include({

    /**
     * Set whether we are paying an installment before submitting.
     *
     * @override method from payment.payment_form
     * @private
     * @param {Event} ev
     * @return {void}
     */
    async _submitForm(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        const paymentDialog = this.el.closest('#pay_with');
        const chosenPaymentDetails = paymentDialog ? paymentDialog.querySelector('.o_btn_payment_tab.active'): null;
        if (chosenPaymentDetails && chosenPaymentDetails.id === 'o_payment_installments_tab') {
            this.paymentContext.payNextInstallment = true;
        }
        await this._super(...arguments);
    },

    /**
     * Add installment specific params for the RPC to the transaction route.
     *
     * @override method from payment.payment_form
     * @private
     * @return {object} The transaction route params.
     */
    _prepareTransactionRouteParams() {
        const transactionRouteParams = this._super(...arguments);

        const amountCustom = this.paymentContext.amountCustom !== undefined
            ? parseFloat(this.paymentContext.amountCustom) : null;
        const amountNextInstallment = this.paymentContext.amountNextInstallment !== undefined
            ? parseFloat(this.paymentContext.amountNextInstallment) : null;

        if (amountCustom) {
            transactionRouteParams['amount'] = amountCustom;
        }

        if (this.paymentContext.payNextInstallment) {
            if (!amountCustom) {
                transactionRouteParams['amount'] = amountNextInstallment;
            }
            transactionRouteParams['installment_number'] = this.paymentContext.numberNextInstallment;
        }

        return transactionRouteParams;
    },

});
