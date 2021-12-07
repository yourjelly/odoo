# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from werkzeug.urls import url_encode
import werkzeug

from odoo import http
from odoo.http import request

from odoo.addons.payment_stripe.controllers import main

_logger = logging.getLogger(__name__)


class StripeController(main.StripeController):

    @http.route('/payment/stripe/onboarding/return', type='http', auth='public', csrf=False)
    def stripe_onboarding_return(self):
        """Stripe return URL

            This route is used by Stripe to return after or during the onboarding.
            Once called, the controller tests the account status of the Onboarded Stripe account
            and redirect to it.

            :returns: Redirection to Stripe Acquirer Form
        """
        stripe_acquirer = request.env.ref('payment.payment_acquirer_stripe')
        return self._redirect_payment_acquirer(stripe_acquirer)

    @http.route('/payment/stripe/onboarding/refresh/<account_id>', type='http', auth='public', csrf=False)
    def stripe_onboarding_refresh(self, account_id=None):
        """Stripe refresh URL

            This route is used by Stripe to refresh its onboarding. Once called, the controller regenerates an account link
            and redirect to it.

            :returns: Redirection to Stripe Onboarding
        """
        stripe_acquirer = request.env.ref('payment.payment_acquirer_stripe')
        if not account_id:
            url = stripe_acquirer._onboarding_url()
        else:
            url = stripe_acquirer._get_stripe_account_link(account_id)
        if not url:
            return self._redirect_payment_acquirer(stripe_acquirer)
        return werkzeug.utils.redirect(url)

    def _redirect_payment_acquirer(self, stripe_acquirer):
        url_params = {
            'model': stripe_acquirer._name,
            'id': stripe_acquirer.id,
            'active_id': stripe_acquirer.id,
            'menu_id': request.env.ref('payment.payment_acquirer_menu').id,
            'view_type': 'form',
            'action': request.env['ir.model.data']._xmlid_to_res_id('payment_stripe_connect.action_payment_acquirer_onboarding'),
        }
        return request.redirect('/web?#%s' % url_encode(url_params))
