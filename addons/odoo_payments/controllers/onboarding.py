# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class OnboardingController(http.Controller):

    """ This controller is responsible for the onboarding (account creation) flow of Odoo Payments.

    The following routes are exposed:
    - `/odoo_payments/create_account` is the route the user is redirected to after retrieving a
       creation token on the merchant instance (odoo.com).
    """

    @http.route('/odoo_payments/create_account', type='http', methods=['GET'], auth='user')
    def odoo_payments_create_account(self, creation_token):
        """ Store the creation token in the session and redirect to the account creation form.

        The user is redirected to this route by the merchant instance (odoo.com) after having been
        redirected there to fetch a creation token when bootstrapping the account creation flow.

        :param str creation_token: The creation token provided by the merchant instance
        """
        request.session['odoo_payments_creation_token'] = creation_token
        return request.redirect('/web?#action=odoo_payments.action_view_adyen_account')
