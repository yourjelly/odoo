/** @odoo-module */
/* global Stripe */

import core from "web.core";
import { StripeOptions } from '@payment_stripe/js/stripe_options';

const _t = core._t;

export const stripeMixin = {

    _get_elements_parameters() {
        return {
            appearance: { theme: 'stripe' },
            currency: this.txContext.currencyName,
            captureMethod: this.txContext.captureMethod,
        }
    },

    async _stripe_confirm(processingValues) {},

    /**
     * Prepare the inline form of Stripe for direct payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the selected payment option's provider
     * @param {number} paymentOptionId - The id of the selected payment option
     * @param {string} flow - The online payment flow of the selected payment option
     * @return {Promise}
     */
    async _prepareInlineForm(code, paymentOptionId, flow) {
        if (code !== 'stripe') {
            return this._super(...arguments);
        }

        // Check if instantiation of the element is needed
        if (flow === 'token') {
            return Promise.resolve(); // No elements for tokens
        } else if (this.stripeElement && this.stripeElement.providerId === paymentOptionId) {
            this._setPaymentFlow('direct'); // Overwrite the flow even if no re-instantiation
            return Promise.resolve(); // Don't re-instantiate if already done for this provider
        }

        // Overwrite the flow of the select payment option
        this._setPaymentFlow('direct');

        const stripeInlineForm = document.getElementById(
            `o_stripe_${this.formType}_element_container_${paymentOptionId}`
        );
        const {
            captureMethod,
            currencyName,
            inlineFormValues,
            stripePublishableKey,
        } = stripeInlineForm.dataset;
        this.txContext = {...this.txContext, captureMethod, currencyName, ...JSON.parse(inlineFormValues)};
        this.stripeJS = Stripe(
            stripePublishableKey,
            new StripeOptions()._prepareStripeOptions(stripeInlineForm.dataset),  // The values needed for Stripe Connect generically happen to the dataset.
        );

        this.stripeElement =  this.stripeJS.elements(this._get_elements_parameters());
        this.stripeElement.providerId = paymentOptionId;
        const paymentElement = this.stripeElement.create('payment', {
            defaultValues: {
                billingDetails: this.txContext.billingDetails,
            },
            layout: {
                type: 'accordion',
                defaultCollapsed: false,
                radios: false,
                spacedAccordionItems: true,
            },
            terms: {
                'auBecsDebit': 'never',
                'bancontact': 'never',
                'card': 'never',
                'ideal': 'never',
                'sepaDebit': 'never',
                'sofort': 'never',
                'usBankAccount': 'never',
            },
        });
        paymentElement.mount(stripeInlineForm);
        if (this.formType == 'checkout' && !this.txContext.isTokenizationRequired) paymentElement.on('change', (ev) => {
            this.selectedPaymentMethod = ev.value.type;
            const stripeTokenCheckbox = document.getElementById(
                `o_payment_provider_inline_${this.formType}_form_${paymentOptionId}`
            ).querySelector("input[name='o_payment_save_as_token']");
            stripeTokenCheckbox.addEventListener('change', (ev) => {
                if(ev.currentTarget.checked) {
                    this._show_terms();
                } else {
                    this._hide_terms();
                }
            });
            paymentElement.on('change', (ev) => {
                this.selectedPaymentMethod = ev.value.type;
                if (this.txContext.paymentMethodsTokenizationSupport[this.selectedPaymentMethod]) {
                    stripeTokenCheckbox.disabled = false;
                    stripeTokenCheckbox.removeAttribute('title');
                } else {
                    stripeTokenCheckbox.disabled = true;
                    stripeTokenCheckbox.checked = false;
                    stripeTokenCheckbox.title = _t("The selected payment method does not support saving.");
                }
            });
        }
    },

    /**
     * Process the payment.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} code - The code of the provider
     * @param {number} providerId - The id of the provider handling the transaction
     * @param {object} processingValues - The processing values of the transaction
     * @return {Promise}
     */
    async _processDirectPayment(code, providerId, processingValues) {
        if (code !== 'stripe') {
            return this._super(...arguments);
        }
        if (this.stripeElement === undefined) { // Elements has not been properly instantiated
            this._displayError(
                _t("Server Error"), _t("We are not able to process your payment.")
            );
        } else {
            const {error} = await this._stripe_confirm(processingValues);
            if (error) {
                this._displayError(
                    _t("Server Error"),
                    _t("We are not able to process your payment."),
                    error.message
                );
            }
        }
    },

    /**
     * Trigger the form validation by submitting the elements.
     *
     * @override method from payment.payment_form_mixin
     * @private
     * @param {string} provider - The provider of the payment option's provider
     * @param {number} paymentOptionId - The id of the payment option handling the transaction
     * @param {string} flow - The online payment flow of the transaction
     * @return {Promise}
     */
    async _processPayment(provider, paymentOptionId, flow) {
        if (provider !== 'stripe' || flow === 'token') {
            return this._super(...arguments);
        }
        if (this.stripeElement === undefined) { // Elements has not been properly instantiated
            this._displayError(
                _t("Server Error"), _t("We are not able to process your payment.")
            );
        } else {
            // Trigger form validation and wallet collection
            const _super = this._super.bind(this);
            const {error: submitError} = await this.stripeElement.submit();
            if (submitError) {
                this._displayError(
                    _t("Incorrect Payment Details"),
                    _t("Please verify your payment details."),
                );
            } else { // There is no error in the form, continue the normal flow
                return _super(...arguments);
            }
        }
    },
};
