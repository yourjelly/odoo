/** @odoo-module */

import manageForm from 'payment.manage_form';
import { stripeMixin } from '@payment_stripe/js/stripe_mixin';

manageForm.include(stripeMixin);
manageForm.include({
    _get_elements_parameters() {
        return {
            ...this._super(...arguments),
            mode: 'setup',
            setupFutureUsage: 'off_session',
        }
    },

    async _stripe_confirm(processingValues) {
        await this._super(...arguments);
        return await this.stripeJS.confirmSetup({
            elements: this.stripeElement,
            clientSecret: processingValues.client_secret,
            confirmParams: {
                return_url: processingValues.return_url,
            },
        });
    }
});
