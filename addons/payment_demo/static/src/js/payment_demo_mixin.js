/** @odoo-module **/

    import rpc from "web.rpc";

    export const paymentDemo = {
        /**
         * Simulate a feedback from a payment provider and redirect the customer to the status page.
         *
         * @private
         * @param {object} processingValues - The processing values of the transaction
         * @return {Promise}
         */
        async processDemoPayment(processingValues) {
            const customerInput = document.getElementById('customer_input').value;
            const simulatedPaymentState = document.getElementById('simulated_payment_state').value;

            await rpc.query({
                route: '/payment/demo/simulate_payment',
                params: {
                    'reference': processingValues.reference,
                    'payment_details': customerInput,
                    'simulated_state': simulatedPaymentState,
                },
            });
            window.location = '/payment/status';
        },
    };
