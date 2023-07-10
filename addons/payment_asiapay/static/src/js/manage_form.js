/** @odoo-module **/

import manageForm from '@payment/js/manage_form';
import asiapayMixin from '@payment_asiapay/js/asiapay_mixin';

manageForm.include(asiapayMixin);
