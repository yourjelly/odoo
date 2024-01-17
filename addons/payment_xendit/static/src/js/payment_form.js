/** @odoo-module */
/* global Xendit */

import { _t } from '@web/core/l10n/translation';
import { loadJS } from '@web/core/assets'

import paymentForm from '@payment/js/payment_form';
import { rpc, RPCError } from '@web/core/network/rpc';

paymentForm.include({
    xenditData: undefined,

    // #=== DOM MANIPULATION ===#

    /**
     * Prepare the inline form of Xendit for direct payment.
     *
     * @private
     * @param {number} providerId - The id of the selected payment option's provider.
     * @param {string} providerCode - The code of the selected payment option's provider.
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @param {string} paymentMethodCode - The code of the selected payment method, if any.
     * @param {string} flow - The online payment flow of the selected payment option.
     * @return {void}
     */
    async _prepareInlineForm(providerId, providerCode, paymentOptionId, paymentMethodCode, flow) {
        if (providerCode !== 'xendit' || paymentMethodCode != 'card') {
            this._super(...arguments);
            return;
        }

        // Check if the inline form values were already extracted.
        this.xenditData ??= {}; // Store the form data of each instantiated payment method.
        if (flow === 'token') {
            return; // Don't show the form for tokens.
        } else if (this.xenditData[paymentOptionId]) {
            this._setPaymentFlow('direct'); // Overwrite the flow even if no re-instantiation.
            return; // Don't re-extract the data if already done for this payment method.
        }

        // Overwrite the flow of the selected payment method.
        this._setPaymentFlow('direct');

        // Extract and deserialize the inline form values.
        const radio = document.querySelector('input[name="o_payment_radio"]:checked');
        const inlineForm = this._getInlineForm(radio);
        const xenditForm = inlineForm.querySelector('[name="o_xendit_form"]');
        this.xenditData[paymentOptionId] = JSON.parse(
            xenditForm.dataset['xenditInlineFormValues']
        );
        this.xenditData[paymentOptionId].form = xenditForm;

        // Load the SDK.
        await loadJS("https://js.xendit.co/v1/xendit.min.js");

        Xendit.setPublishableKey(this.xenditData[paymentOptionId]['public_key'])
    },

    // #=== PAYMENT FLOW ===#

    /**
     * Trigger the payment processing by submitting the data.
     *
     * @override method from payment.payment_form
     * @private
     * @param {string} providerCode - The code of the selected payment option's provider.
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @param {string} paymentMethodCode - The code of the selected payment method, if any.
     * @param {string} flow - The payment flow of the selected payment option.
     * @return {void}
     */
    async _initiatePaymentFlow(providerCode, paymentOptionId, paymentMethodCode, flow) {
        if (providerCode !== 'xendit' || flow === 'token' || paymentMethodCode != 'card') {
            this._super(...arguments); // Tokens are handled by the generic flow
            return;
        }
        const formInputs = this._xenditGetInlineFormInputs(paymentOptionId, paymentMethodCode)
        const details = this._xenditGetPaymentDetails(paymentOptionId, paymentMethodCode)

        Object.keys(formInputs).forEach(el => formInputs[el].setCustomValidity(""))
        if(!Xendit.card.validateCardNumber(details.card_number)){
            formInputs['card'].setCustomValidity(_t("Invalid Card Number"))
        }
        if(!Xendit.card.validateExpiry(details.card_exp_month, details.card_exp_year)){
            formInputs['month'].setCustomValidity(_t("Invalid Date"))
            formInputs['year'].setCustomValidity(_t("Invalid Date"))
        }
        if(!Xendit.card.validateCvn(details.card_cvn)){
            formInputs['cvn'].setCustomValidity(_t("Invalid CVN"))
        }

        const inputs = Object.values(formInputs);

        // Checking the elements
        if (!inputs.every(element => element.reportValidity())) {
            this._enableButton(); // The submit button is disabled at this point, enable it
            return;
        }

        await this._super(...arguments);
    },

    /**
     * Process the direct payment flow.
     *
     * @override method from payment.payment_form
     * @private
     * @param {string} providerCode - The code of the selected payment option's provider.
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @param {string} paymentMethodCode - The code of the selected payment method, if any.
     * @param {object} processingValues - The processing values of the transaction.
     * @return {void}
     */
    async _processDirectFlow(providerCode, paymentOptionId, paymentMethodCode, processingValues) {
        if (providerCode !== 'xendit') {
            this._super(...arguments);
            return;
        }

        // if tokenize, use multiUse token
        const payload = {
            ...this._xenditGetPaymentDetails(paymentOptionId, paymentMethodCode),
            is_multiple_use: true,
            should_authenticate: false,
        }

        Xendit.card.createToken(
            payload,
            (err, token) => this._xenditHandleResponse(err, token, processingValues)
        )
    },

    /**
     * Handle response after Xendit requests and initiate payment
     *
     * @param {object} err - Error obejct with cause
     * @param {object} token - Token data created
     * @return {void}
     */
    _xenditHandleResponse(err, token, processingValues) {
        // error handling
        if (err) {
            this._displayErrorDialog(_t("Payment processing failed"), err.message);
            this._enableButton();
            return;
        }
        if (token.status === "VERIFIED") {
            rpc('/payment/xendit/payment', {
                'reference': processingValues.reference,
                'partner_id': processingValues.partner_id,
                'token_id': token.id,
            }).then(() => {
                window.location = '/payment/status'
            }).catch((error) => {
                if (error instanceof RPCError) {
                    this._displayErrorDialog(_t("Payment processing failed"), error.data.message);
                    this._enableButton();
                } else {
                    return Promise.reject(error);
                }
            })
        } else if (token.status === 'FAILED') {
            this._displayErrorDialog(_t("Payment processing failed"), token.failure_reason);
            this._enableButton();
            return;
        }
    },

    // #=== GETTERS ===#

    /**
     * Return all relevant inline form inputs based on the payment method type of the provider.
     *
     * @private
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @return {Object} - An object mapping the name of inline form inputs to their DOM element.
     */
    _xenditGetInlineFormInputs(paymentOptionId) {
        const form = this.xenditData[paymentOptionId]['form'];
        return {
            card: form.querySelector('#o_xendit_card'),
            month: form.querySelector('#o_xendit_month'),
            year: form.querySelector('#o_xendit_year'),
            cvn: form.querySelector('#o_xendit_cvn'),
        };
    },

    /**
     * Return the credit card data to prepare the payload for the create token request.
     *
     * @private
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @return {Object} - Data to pass to the Xendit createToken request.
     */
    _xenditGetPaymentDetails(paymentOptionId) {
        const inputs = this._xenditGetInlineFormInputs(paymentOptionId);
        return {
            card_number: inputs.card.value.replace(/ /g, ''),
            card_exp_month: inputs.month.value,
            card_exp_year: '20' + inputs.year.value,
            card_cvn: inputs.cvn.value,
        };
    },

})
