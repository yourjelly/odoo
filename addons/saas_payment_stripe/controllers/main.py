# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from werkzeug.urls import url_encode

from odoo import http
from odoo.http import request

from odoo.addons.payment_stripe_connect.controllers import main

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
        stripe_acquirer._update_stripe_onboarding_status()
        if stripe_acquirer.stripe_account_validated:
            stripe_acquirer.state = 'enabled'
            menu_id = request.env['ir.model.data']._xmlid_to_res_id('website.menu_website_configuration')
            url_params = {
                'menu_id': menu_id,
            }
            return menu_id and request.redirect('/web?#%s' % url_encode(url_params)) or request.redirect('/web')
        return super().stripe_onboarding_return()

    def _redirect_payment_acquirer(self, acquirer):
        return super()._redirect_payment_acquirer(acquirer)
