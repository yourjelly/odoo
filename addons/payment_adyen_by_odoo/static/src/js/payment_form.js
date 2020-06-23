odoo.define('payment_adyen_by_odoo.payment_form', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var Dialog = require('web.Dialog');
var PaymentForm = require('payment.payment_form');

var qweb = core.qweb;
var _t = core._t;

ajax.loadXML('/payment_adyen/static/src/xml/adyen_templates.xml', qweb);

PaymentForm.include({

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
        const paymentMethods = await this._rpc({
            route: '/payment/adyen_by_odoo/get_payment_methods',
            params: {
                acquirer_id: formData.acquirer_id
            },
        });
        const configuration = {
            paymentMethodsResponse: paymentMethods,
            originKey: 'pub.v2.8015616193480340.aHR0cHM6Ly9vZG9vLnRlc3Q.ZZuuRYlkk49NWTCcs4JYnwK0x6pQoitDEQBIZXtz36A',
            locale: 'fr',
            environment: 'test',
            onSubmit: this._adyenSubmitPayment.bind(this),
            onAdditionalDetails: (state, data) => {console.log(state, data)},
            showPayButton: false,
        };
        const checkout = new AdyenCheckout(configuration);
        this.adyenDropin = await checkout.create('dropin').mount('#dropin-container');
        return true;
    },

    _adyenRemovePaymentMethods: function () {
        this.adyenDropin = undefined;
    },

    _adyenSubmitPayment: async function(adyenState, adyenDropin) {
        const self = this;
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
            const txReference = txForm.querySelector('input[name="reference"]').value;
            const txSignature = txForm.querySelector('input[name="signature"]').value;
            return this._rpc({
                route: '/payment/adyen_by_odoo/submit_payment',
                params: {
                    adyen_data: adyenState.data,
                    acquirer_id: acquirerID,
                    tx_reference: txReference,
                    tx_signature: txSignature,
                },
            });
        }).then(async (result) => {
            if (result.action) {
                const auth_result = await this.adyenDropin.handleAction(result.action);
            }
        }).guardedCatch((error) => {
            // We don't want to open the Error dialog since
            // we already have a container displaying the error
            if (error.event) {
                error.event.preventDefault();
            }
            // if the rpc fails, pretty obvious
            //this.enableButton(button);
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
            return this.adyenDropin.submit();
        } else {
            return this._super.apply(this, arguments);
        }
    },
});
});
