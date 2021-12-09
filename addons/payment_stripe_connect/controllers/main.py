# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from werkzeug.urls import url_encode
import werkzeug

from odoo import http
from odoo.http import request
from odoo.exceptions import UserError

from odoo.addons.payment_stripe.controllers import main

_logger = logging.getLogger(__name__)


class StripeController(main.StripeController):

    @http.route('/payment/stripe/onboarding/return/<int:acquirer_id>', type='http', auth='public', csrf=False)
    def stripe_onboarding_return(self, acquirer_id, scope=None, code=None, **kwargs):
        """Stripe return URL

            This route is used by Stripe to return after or during the onboarding.
            Once called, the controller tests the account status of the Onboarded Stripe account
            and redirect to it.

            :returns: Redirection to Stripe Acquirer Form
        """
        stripe_acquirer = request.env['payment.acquirer'].sudo().browse(acquirer_id)
        request_csrf = kwargs.get('state')
        if not request_csrf or request_csrf != stripe_acquirer.csrf_token or \
           kwargs.get('error') or kwargs.get('error_description'):
            return self._redirect_payment_acquirer(stripe_acquirer)
        try:
            stripe_acquirer._stripe_oauth_token(code)
        except UserError:
            return self._redirect_payment_acquirer(stripe_acquirer)
        menu_id = request.env['ir.model.data']._xmlid_to_res_id('website.menu_website_configuration')
        url_params = {
            'menu_id': menu_id,
        }
        return menu_id and request.redirect('/web?#%s' % url_encode(url_params)) or request.redirect('/web')

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
