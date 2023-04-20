/** @odoo-module **/
    
    import paymentPostProcessing from "payment.post_processing";

    paymentPostProcessing.include({
        /**
         * Don't wait for the transaction to be confirmed before redirecting customers to the
         * landing route because custom transactions remain in the state 'pending' forever.
         *
         * @override method from `payment.post_processing`
         * @param {Object} display_values - The post-processing values of the transaction
         */
        processPolledData: function (display_values) {
            if (display_values.provider_code === 'custom') {
                window.location = display_values.landing_route;
            } else {
                return this._super(...arguments);
            }
        }
    });
