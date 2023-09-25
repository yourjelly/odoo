/** @odoo-module **/
/* global Razorpay */

import { _t } from "@web/core/l10n/translation";
import paymentForm from '@payment/js/payment_form';


paymentForm.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _processRedirectFlow(providerCode, paymentOptionId, paymentMethodCode, processingValues) {
        if (providerCode !== 'razorpay' || !this.paymentContext.tokenizationRequested) {
            this._super(...arguments);
            return;
        }
        const razorpayOptions = this._prepareRazorpayOptions(processingValues);
        const rzp = Razorpay(razorpayOptions);
        rzp.open();
        rzp.on('payment.failed', (resp) => {
            this._displayError(
                _t("Server Error"),
                _t("We are not able to process your payment."),
                resp.error.description,
            );
        });
    },
   
    /**
     * Prepare the options to init the RazorPay JS Object
     *
     * Function overriden in internal module
     *
     * @param {object} processingValues
     * @return {object}
     */
    _prepareRazorpayOptions(processingValues) {
        return Object.assign({}, processingValues, {
            "key": processingValues.razorpay_key_id,
            "order_id": processingValues.order_id,
            "customer_id": processingValues.customer_id,
            "description": processingValues.reference,
            "recurring": "1",
            "handler": (resp) => {
                if (resp.razorpay_payment_id && resp.razorpay_order_id && resp.razorpay_signature) {
                    window.location = '/payment/status';

                }
            },
            "modal": {
                "ondismiss": () => {
                        window.location.reload();
                    }
            },
        });
    },

});

