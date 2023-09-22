/** @odoo-module **/
/* global CareemPay */

import { paymentExpressCheckoutForm } from '@payment/js/express_checkout_form';

paymentExpressCheckoutForm.include({

    /**
     * Return all express checkout forms found on the page.
     *
     * @override
     * @private
     * @return {NodeList} - All express checkout forms found on the page.
     */
    _getExpressCheckoutForms() {
        return [...this._super(...arguments)].concat([...document.querySelectorAll(
            'form[name="o_payment_express_checkout_form"] cpay-checkout-button[name="o_express_checkout_container"]'
        )]);
    },
    /**
     * Prepare the express checkout form of Careem Pay for One Click payment.
     *
     * @override method from payment.express_form
     * @private
     * @param {Object} providerData - The provider-specific data.
     * @return {Promise}
     */
    async _prepareExpressCheckoutForm(providerData) {
        if (providerData.providerCode !== "careem" || !this.txContext.amount) {
            return this._super(...arguments);
        }
        const careemButton = document.getElementById("checkoutBtn");

         if (!window.CareemPay) {
             await new Promise((resolve) => {
                 document
                     .getElementById("careemPayScript")
                     .addEventListener("load", resolve);
             })
         }
        careemButton.disabled = false;

        const careemPay = CareemPay(providerData.clientId, {
            env: providerData.providerId === "enabled" ? "production" : "sandbox",
            mode: providerData.mode
        });
        careemPay.attach(careemButton);

        careemButton.addEventListener("checkout", CareemPay.handleCheckout(async (paymentAttempt) => {
            try {
                await this._doPaymentAttempt(paymentAttempt, providerData);
            } catch (error) {
                // Handle the timeout or cleanup error here
                console.error("Checkout attempt failed:", error);
            }
        }));
    },

    async _doPaymentAttempt(paymentAttempt, providerData) {
        const {id: invoiceId} = await this._rpc({
            route: this.txContext.transactionRoute,
            params: this._prepareTransactionRouteParams(providerData.providerId),
        })
        .catch(() => paymentAttempt.fail());
        if (!invoiceId) return;
        return paymentAttempt.begin(invoiceId).then(
            () => window.location = '/payment/careem/return?id=' + invoiceId
        );
    }
});
