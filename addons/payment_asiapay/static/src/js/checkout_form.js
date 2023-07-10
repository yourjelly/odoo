/** @odoo-module **/

import checkoutForm from '@payment/js/checkout_form';
import asiapayMixin from '@payment_asiapay/js/asiapay_mixin';

checkoutForm.include(asiapayMixin);
