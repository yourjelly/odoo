/** @odoo-module **/
/* global Asiapay */

export default {
    /**
         * Redirect the customer to the status route.
         *
         * For a provider to redefine the processing of the payment by token flow, it must override
         * this method.
         *
         * @private
         * @param {string} code - The code of the token's provider
         * @param {number} paymentOptionId - The id of the token handling the transaction
         * @param {object} processingValues - The processing values of the transaction
         * @return {undefined}
         */
    _processTokenPayment(code, paymentOptionId, processingValues) {
        if (code !== 'asiapay') {
            return this._super(...arguments);
        }
        return this._processRedirectPayment(code, paymentOptionId, processingValues);
    },
}
