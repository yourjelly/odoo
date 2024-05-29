/* global paypal */

import { _t } from '@web/core/l10n/translation';
import paymentForm from '@payment/js/payment_form';
import { rpc, RPCError } from '@web/core/network/rpc';

paymentForm.include({
    inlineFormValues: undefined,
    paypalColor: 'blue',
    paypalButtons: undefined,

    // #=== DOM MANIPULATION ===#

    /**
     * Open the inline form of the selected payment option and collapse the others.
     *
     * @private
     * @param {HTMLInputElement} radio - The radio button linked to the payment option.
     * @return {void}
     */
    async _expandInlineForm(radio) {
        const providerCode = this._getProviderCode(radio);
        if (providerCode != 'paypal') {
            document.getElementById("o_provider_payment_submit_button").classList.add("d-none");
        }
        else {
            if (!this.paypalButtons) {
                document.getElementById("o_paypal_loading").classList.remove("d-none");
            }
            document.getElementById("o_provider_payment_submit_button").classList.remove("d-none");
        }
        this._super(...arguments);
    },
    /**
     * Prepare the inline form of Paypal for direct payment.
     *
     * @override method from @payment/js/payment_form
     * @private
     * @param {number} providerId - The id of the selected payment option's provider.
     * @param {string} providerCode - The code of the selected payment option's provider.
     * @param {number} paymentOptionId - The id of the selected payment option
     * @param {string} paymentMethodCode - The code of the selected payment method, if any.
     * @param {string} flow - The online payment flow of the selected payment option.
     * @return {void}
     */
    async _prepareInlineForm(providerId, providerCode, paymentOptionId, paymentMethodCode, flow) {
        if (providerCode !== 'paypal') {
            this._super(...arguments);
            return;
        } else if (flow === 'token') {
            return;
        }

        this._hideInputs();
        this._setPaymentFlow('direct');
        Object.assign(this.paymentContext, {
            tokenizationRequested: false,
            providerId: providerId,
            paymentMethodId: paymentOptionId,
        });

        if (!this.paypalButtons) {
            const radio = document.querySelector('input[name="o_payment_radio"]:checked');
            if (radio) {
                this.inlineFormValues = JSON.parse(radio.dataset['paypalInlineFormValues']);
                this.paypalColor = radio.dataset['paypalColor']
            }
            // PayPal Code
            let initiatePaypalSDK = (url) => {
                return new Promise(function (resolve, reject) {
                    var script = document.createElement('script');
                    script.src = url;
                    script.type = "module";
                    script.onload = function () {
                        resolve();
                    };
                    script.onerror = function () {
                        reject('Error loading script.');
                    };
                    document.head.appendChild(script);
                });
            }
            const paypal_sdk_url = "https://www.paypal.com/sdk/js";

            //https://developer.paypal.com/sdk/js/configuration/#link-queryparameters
            const { client_id, currency, intent } = this.inlineFormValues
            initiatePaypalSDK(
                paypal_sdk_url + "?client-id=" + client_id +
                "&components=buttons" +
                "&currency=" + currency +
                "&intent=" + intent
            ).then(() => {
                document.getElementById("o_paypal_loading").classList.add("d-none");
                this.paypalButtons = paypal.Buttons({ // https://developer.paypal.com/sdk/js/reference
                    fundingSource: paypal.FUNDING.PAYPAL,
                    style: { // https://developer.paypal.com/sdk/js/reference/#link-style
                        color: this.paypalColor,
                        label: 'paypal',
                        disableMaxWidth: true,
                        borderRadius: 6,
                    },
                    createOrder: this._paypalOnClick.bind(this),
                    onApprove: this._paypalOnApprove.bind(this),
                    onError: this._paypalOnError.bind(this),
                    onCancel: ()=>{}, // do nothing
                });
                this.paypalButtons.render('#o_provider_payment_submit_button');
            }).catch((error) => {
                this._paypalOnError(error)
            });
        }
    },
    // #=== PAYMENT FLOW ===#

    /**
     * Handle the click event of the component and initiate the payment.
     *
     * @private
     * @param {object} state - The state of the component.
     * @param {object} component - The component.
     * @return {void}
     */
    _paypalOnClick(state, component) {
        // Create the transaction and retrieve the processing values.
        return rpc(
            this.paymentContext['transactionRoute'],
            this._prepareTransactionRouteParams(),
        ).then(processingValues => {
            return processingValues.order_id
        }).catch(error => {
            if (error instanceof RPCError) {
                throw error.data
            } else {
                throw error
            }
        });
    },
    /**
     * Handle the approval event of the component and complete the payment.
     *
     * @private
     * @param {object} state - The state of the component.
     * @param {object} component - The component.
     * @return {void}
     */
    _paypalOnApprove(data, actions) {
        const orderID = data.orderID;
        const { intent, provider_id } = this.inlineFormValues

        return rpc("/payment/paypal/complete_order", {
            "provider_id": provider_id,
            "intent": intent,
            "order_id": orderID,
        }).then(() => {
            //Close out the PayPal buttons that were rendered
            this.paypalButtons.close();
            window.location = '/payment/status';
        })
    },
    /**
     * Handle the error event of the component.
     * @private
     * @param {object} error - The error in the component.
     * @return {void}
     */
    _paypalOnError(error) {
        this._displayErrorDialog(_t("Payment processing failed"), error.message);
    },
});
