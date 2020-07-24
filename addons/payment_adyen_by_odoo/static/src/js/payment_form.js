odoo.define('payment_adyen_by_odoo.payment_form', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var Dialog = require('web.Dialog');
var PaymentForm = require('payment.payment_form');

var qweb = core.qweb;
var _t = core._t;

ajax.loadXML('/payment_adyen/static/src/xml/adyen_templates.xml', qweb);
const html = document.documentElement;
const locale = html.getAttribute('lang') || 'en-US';

PaymentForm.include({
    willStart: function () {
        return this._super.apply(this, arguments).then(function () {
            return ajax.loadJS("https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/3.8.1/adyen.js");
        })
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _adyenShowPaymentMethods: async function ($checkedRadio) {
        const acquirerID = this.getAcquirerIdFromRadio($checkedRadio);
        const acquirerForm = this.$('#o_payment_add_token_acq_' + acquirerID);
        const inputsForm = $('input', acquirerForm);
        if (this.options.partnerId === undefined) {
            console.warn('payment_form: unset partner_id when adding new token; things could go wrong');
        }
        const formData = this.getFormData(inputsForm);
        const configuration = await this._rpc({
            route: '/payment/adyen_by_odoo/dropin_configuration',
            params: {
                acquirer_id: formData.acquirer_id,
                partner_id: this.options.partnerId,
            },
        });
        // extra configuration for DropIn that has to be added in the frontend (handlers)
        Object.assign(configuration, {
            locale: locale,
            onSubmit: this._adyenSubmitPayment.bind(this),
            onError: this._adyenOnError.bind(this),
            onAdditionalDetails: this._adyenAdditionalDetails.bind(this),
        });
        const checkout = new AdyenCheckout(configuration);
        this.adyenDropin = await checkout.create('dropin').mount('#dropin-container');
        return true;
    },

    _adyenRemovePaymentMethods: function () {
        this.adyenDropin = undefined;
        this.adyenTxReference = undefined;
        this.adyenTxSignature = undefined;
    },

    _adyenOnError: function () {
        this.enableButton(this.adyenPayButton);
    },

    _adyenSubmitPayment: async function(adyenState, adyenDropin) {
        const $checkedRadio = this.$('input[type="radio"]:checked');
        const acquirerID = this.getAcquirerIdFromRadio($checkedRadio);
        const acquirerForm = this.el.querySelector(`#o_payment_add_token_acq_${acquirerID}`);
        const prepareTxUrl = this.el.querySelector('input[name="prepare_tx_url"]').value;
        const saveTokenInput = acquirerForm.querySelector('input[name="o_payment_form_save_token"]');
        const shouldSaveToken = saveTokenInput && saveTokenInput.checked;
        // this crappy hack will fetch the reference for the tx through an html form -_-
        return this._rpc({
            route: prepareTxUrl,
            params: {
                acquirer_id: parseInt(acquirerID),
                save_token: shouldSaveToken,
                access_token: this.options.accessToken,
                success_url: this.options.successUrl,
                error_url: this.options.errorUrl,
                callback_method: this.options.callbackMethod,
                order_id: this.options.orderId,
            },
        }).then((txFormContent) => {
            const txForm = document.createElement('form');
            txForm.innerHTML = txFormContent;
            this.adyenTxReference = txForm.querySelector('input[name="reference"]').value;
            this.adyenTxSignature = txForm.querySelector('input[name="signature"]').value;
            return this._rpc({
                route: '/payment/adyen_by_odoo/submit_payment',
                params: {
                    adyen_data: adyenState.data,
                    acquirer_id: acquirerID,
                    tx_reference: this.adyenTxReference,
                    tx_signature: this.adyenTxSignature,
                },
            });
        }).then(async (result) => {
            if (result.action) {
                // further action needed (e.g. redirect or inline 3DS validation)
                const auth_result = await this.adyenDropin.handleAction(result.action);
            } else if (result.resultCode) {
                // transaction has reached a final state
                window.location = "/payment/process"
            }
        }).guardedCatch((error) => {
            // We don't want to open the Error dialog since
            // we already have a container displaying the error
            if (error.event) {
                error.event.preventDefault();
            }
            // if the rpc fails, pretty obvious
            this.enableButton(this.adyenPayButton);
            this.displayError(
                _t('Unable to save card'),
                _t("We are not able to add your payment method at the moment. ") +
                    this._parseError(error)
            );
        });
    },

    _adyenAdditionalDetails: async function (adyenState, adyenDropin) {
        const $checkedRadio = this.$('input[type="radio"]:checked');
        const acquirerID = this.getAcquirerIdFromRadio($checkedRadio);
        return this._rpc({
            route: '/payment/adyen_by_odoo/get_payment_details',
            params: {
                acquirer_id: acquirerID,
                adyen_data: adyenState.data,
                tx_reference: this.adyenTxReference,
            },
        }).then(async (result) => {
            if (result.action) {
                // possibly another action needed (usually 3DSv2)
                const auth_result = await this.adyenDropin.handleAction(result.action);
            } else if (result.resultCode) {
                // transaction has reached a final state
                window.location = "/payment/process"
            }
        }).guardedCatch((error) => {
            // We don't want to open the Error dialog since
            // we already have a container displaying the error
            if (error.event) {
                error.event.preventDefault();
            }
            // if the rpc fails, pretty obvious
            this.enableButton(this.adyenPayButton);
            this.displayError(
                _t('Unable to save card'),
                _t("We are not able to add your payment method at the moment. ") +
                    this._parseError(error)
            );
        });
    },

    /**
     * @override
     */
    updateNewPaymentDisplayStatus: function () {
        var $checkedRadio = this.$('input[type="radio"]:checked');
        if ($checkedRadio.length !== 1) {
            return;
        }
        var provider = $checkedRadio.data('provider')
        if (provider === 'adyen_by_odoo') {
            // always re-init the element (in case of multiple acquirers)
            this._adyenRemovePaymentMethods();
            this._adyenShowPaymentMethods($checkedRadio);
        }
        return this._super.apply(this, arguments);
    },


    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    payEvent: function (ev) {
        ev.preventDefault();
        var $checkedRadio = this.$('input[type="radio"]:checked');

        // first we check that the user has selected a adyen_by_odoo as s2s payment method
        if ($checkedRadio.length === 1 && $checkedRadio.data('provider') === 'adyen_by_odoo') {
            let button;
            if (ev.type === 'submit') {
                button = $(ev.target).find('*[type="submit"]')[0]
            } else {
                button = ev.target;
            }
            this.adyenPayButton = button;
            this.disableButton(button);
            return this.adyenDropin.submit();
        } else {
            return this._super.apply(this, arguments);
        }
    },

    /**
     * @override
     */
    addPmEvent: function (ev) {
        ev.preventDefault();
        var $checkedRadio = this.$('input[type="radio"]:checked');

        // first we check that the user has selected a adyen_by_odoo as provider
        if ($checkedRadio.length === 1 && $checkedRadio.data('provider') === 'adyen_by_odoo') {
            let button;
            if (ev.type === 'submit') {
                button = $(ev.target).find('*[type="submit"]')[0]
            } else {
                button = ev.target;
            }
            this.disableButton(button);
            return this.adyenDropin.submit();
        } else {
            return this._super.apply(this, arguments);
        }
    },
});
});
