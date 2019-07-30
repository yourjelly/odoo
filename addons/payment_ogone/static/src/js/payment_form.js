odoo.define('payment_ogone.payment_form', function (require) {
    "use strict";
    
    var ajax = require('web.ajax');
    var core = require('web.core');
    var Dialog = require('web.Dialog');
    var Widget = require('web.Widget');
    var PaymentForm = require('payment.payment_form');
       
    var qweb = core.qweb;
    var _t = core._t;
   
    PaymentForm.include({
    
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
    
        /**
         * called when clicking on pay now or add payment event to create token for credit card/debit card.
         *
         * @private
         * @param {Event} ev
         * @param {DOMElement} checkedRadio
         * @param {Boolean} addPmEvent
         */
        _OgoneTransaction: function (ev, $checkedRadio, addPmEvent) {
            var CC_FIELDS = ['cc_cvc', 'cc_number', 'cc_holder_name', 'cc_expiry', 'cc_brand'];
            var self = this;
            var acquirerID = this.getAcquirerIdFromRadio($checkedRadio);
            var acquirerForm = this.$('#o_payment_add_token_acq_' + acquirerID);
            var inputsForm = $('input', acquirerForm);
            var ds = $('input[name="data_set"]', acquirerForm)[0];
            var paymentForm = this.getFormData(self.$el);
            _.omit(paymentForm, CC_FIELDS);
            var param_plus = {
                partner_id: this.options.partnerId,
                paymentForm: JSON.stringify(paymentForm),
                paymentFormAction: self.el.getAttribute('action'),
            };
            param_plus = $.param(param_plus);
            var kwargs =  {
                partner_id: parseInt(this.options.partnerId),
                param_plus: param_plus,
            };
            if (this.options.partnerId === undefined) {
                console.warn('payment_form: unset partner_id when adding new token; things could go wrong');
                kwargs= {};
            }
            var formData = this.getFormData(inputsForm);
            console.log(formData);

            self._rpc({
                model: 'payment.acquirer',
                method: 'ogone_gateway_values',
                args: [[parseInt(formData.acquirer_id)]],
                kwargs: kwargs,
                context: self.context,
            }).then(function (result) {

                result['CVC'] = formData.cc_cvc;
                result['CARDNO'] = formData.cc_number.replace(/\s/g, '');
                result['ED'] = formData.cc_expiry.replace(/\s\/\s/g, '');
                result['CN'] = formData.cc_holder_name;

                // TEST if INPUT FORM IS VALID
                var APIUrl = "https://ogone.test.v-psp.com/ncol/test/Alias_gateway_utf8.asp";
                var ogoneForm = document.createElement("form");
                ogoneForm.method = "POST";
                ogoneForm.action = APIUrl;
                self.add_ogone_3ds_inputs(ogoneForm);
                var el = document.createElement("input");
                el.setAttribute('type', 'submit');
                el.setAttribute('name', "Submit");
                ogoneForm.appendChild(el);
                console.log(result);
                _.each(result, function (value, key) {
                    var el = document.createElement("input");
                    el.setAttribute('type', 'hidden');
                    el.setAttribute('value', value);
                    el.setAttribute('name', key);
                    ogoneForm.appendChild(el);
                });
                document.body.appendChild(ogoneForm);
                ogoneForm.submit();
            });
            
            // FLOW:
            // STEP 1
                // GET THE NEEDED INFORMATION FROM THE BACKEND;
                // ACCEPTURL
                // ALIASPERSISTEDAFTERUSE
                // EXCEPTIONURL
                // ORDERID
                // PSPID
                // SHASIGN : the token
                // PARAMPLUS if needed in the future
            // STEP 2
                // Create the Token which is named Alias in Ingenico denomination. This alias is created when submitting this form.(Pay Now)
                // The alias creation depends on the following fields:
                // ACCEPTURL
                // ALIASPERSISTEDAFTERUSE
                // CARDNO
                // CN
                // CVC
                // ED
                // EXCEPTIONURL
                // ORDERID
                // PSPID= SEE XML FILE
                // SHASIGN= xxx
        },

        add_ogone_3ds_inputs: function createHiddenInput(form) {
            var createHiddenInput = function(name, value) {
                var input = document.createElement("input");
                input.setAttribute("type", "hidden");
                input.setAttribute("name", name); 
                input.setAttribute("value", value);
                form.appendChild(input);
                }

            createHiddenInput("browserColorDepth", screen.colorDepth);
            createHiddenInput("browserJavaEnabled", navigator.javaEnabled());
            createHiddenInput("browserLanguage", navigator.language);
            createHiddenInput("browserScreenHeight", screen.height);
            createHiddenInput("browserScreenWidth", screen.width);
            createHiddenInput("browserTimeZone", new Date().getTimezoneOffset());
        },
        
        /**
         * @override
         */
        updateNewPaymentDisplayStatus: function () {
            var $checkedRadio = this.$('input[type="radio"]:checked');
            var acquirerId = this.getAcquirerIdFromRadio($checkedRadio);
            if ($checkedRadio.length !== 1) {
                return;
            }
    
            //  hide add token form for ogone
            if ($checkedRadio.data('provider') === 'ogone' && this.isNewPaymentRadio($checkedRadio)) {
                //this.$('[id*="o_payment_add_token_acq_"]');
                this.$('#o_payment_add_token_acq_' + acquirerId).removeClass('d-none');
            } else {
                this._super.apply(this, arguments);
            }
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
            // first we check that the user has selected a ogone as s2s payment method
            if ($checkedRadio.length === 1 && this.isNewPaymentRadio($checkedRadio) && $checkedRadio.data('provider') === 'ogone') {
                this._OgoneTransaction(ev, $checkedRadio);
            } else {
                this._super.apply(this, arguments);
            }
        },
        /**
         * @override
         */
        addPmEvent: function (ev) {
            ev.stopPropagation();
            ev.preventDefault();
            var $checkedRadio = this.$('input[type="radio"]:checked');
    
            // first we check that the user has selected a Ogone as add payment method
            if ($checkedRadio.length === 1 && this.isNewPaymentRadio($checkedRadio) && $checkedRadio.data('provider') === 'ogone') {
                this._OgoneTransaction(ev, $checkedRadio, true);
            } else {
                this._super.apply(this, arguments);
            }
        },
    });
    //debugger;
    return PaymentForm;
    });
