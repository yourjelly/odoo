/** @odoo-module **/

/* global Stripe */

import checkoutForm from 'payment.checkout_form';
import manageForm from 'payment.manage_form';
import _unused from 'payment_stripe.payment_form';

const stripeMixin = {

    /**
     * Redirect the customer to Stripe hosted payment page.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} provider - The provider of the payment option's acquirer
     * @param {number} paymentOptionId - The id of the payment option handling the transaction
     * @param {object} processingValues - The processing values of the transaction
     * @return {undefined}
     */
    _processRedirectPayment: function (provider, paymentOptionId, processingValues) {
        if (provider !== 'stripe') {
            return this._super(...arguments);
        }

        const stripeJS = Stripe(processingValues['publishable_key'], {
            stripeAccount: processingValues['stripe_account']
        });
        stripeJS.redirectToCheckout({
            sessionId: processingValues['session_id'],
        });
    },

};

checkoutForm.include(stripeMixin);
manageForm.include(stripeMixin);
