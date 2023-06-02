/** @odoo-module */

import checkoutForm from 'payment.checkout_form';
import { stripeMixin } from '@payment_stripe/js/stripe_mixin';

checkoutForm.include(stripeMixin);
checkoutForm.include({
    _get_elements_parameters() {
        const elements_parameters =  {
            ...this._super(...arguments),
            mode: 'payment',
            amount: parseInt(this.txContext.minorAmount),
        }

        if (this.txContext.isTokenizationRequired) elements_parameters.setupFutureUsage = 'off_session';

        return elements_parameters
    },

    async _stripe_confirm(processingValues) {
        await this._super(...arguments);
        return await this.stripeJS.confirmPayment({
            elements: this.stripeElement,
            clientSecret: processingValues.client_secret,
            confirmParams: {
                return_url: processingValues.return_url,
            },
        });
    },

    /**
     * Prepare the params to send to the transaction route.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the selected payment option provider
     * @param {number} paymentOptionId - The id of the selected payment option
     * @param {string} flow - The online payment flow of the selected payment option
     * @return {object} The transaction route params
     */
    _prepareTransactionRouteParams: function (code, paymentOptionId, flow) {
        const transactionRouteParams = this._super(...arguments);
        if (this.txContext.tokenizationRequested) {
            if (this.txContext.paymentMethodsTokenizationSupport[this.selectedPaymentMethod]) {
                this.stripeElement.update({setupFutureUsage: 'off_session'});
            } else {
                transactionRouteParams.tokenization_requested = false;
            }
        }
        return transactionRouteParams;
    },
});
