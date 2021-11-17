# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class OnboardingController(http.Controller):

    """ This controller is responsible for the onboarding (account creation) flow of Odoo Payments.

    The following routes are exposed:
    - `/odoo_payments/get_creation_redirect_form` retrieve the creation redirect form of the Adyen
      account in the current company.
    """

    @http.route('/odoo_payments/get_creation_redirect_form', type='json', auth='user')
    def odoo_payments_creation_redirect_form(self):
        """ Return the account creation form used to redirect the user to the merchant database.

        :return: The account creation form
        :rtype: str
        """
        return request.env.company.adyen_account_id._get_creation_redirect_form()

    @http.route('/odoo_payments/return', type='http', methods=['GET'], auth='user')
    def odoo_payments_return_from_redirect(
        self, account_holder_code, account_code, adyen_uuid, proxy_token
    ):
        """ Update the account with the data received from the merchant and redirect to the account.

        The user is redirected to this route by the merchant instance (odoo.com) after having been
        redirected there to create the submerchant.

        :param str account_holder_code: The account holder code of the account that must be updated.
                                        Provided with the redirect request to identify the correct
                                        account in multi-company environments.
        :param str account_code: The account code received from Adyen
        :param str adyen_uuid: The account UUID generated by the proxy
        :param str proxy_token: The secret token to authenticate requests from the proxy
        """
        if not self.user_has_groups('base.group_erp_manager'):
            # Adyen Account updates are restricted to users with "Settings" access
            raise Forbidden()
        account_sudo = request.env['adyen.account'].sudo().search([
            ('account_holder_code', '=', account_holder_code),
            ('company_id', 'in', request.env.user.company_ids.ids),
            ('merchant_status', '=', 'draft'),  # Only update the account if not already done
        ], limit=1)  # In sudo to bypass ir.rule preventing accessing accounts from other companies
        if account_sudo:
            account_sudo.with_context(update_from_adyen=True).write({
                'merchant_status': 'pending',  # The validation was successfully initiated
                'account_code': account_code,
                'adyen_uuid': adyen_uuid,
                'proxy_token': proxy_token,
            })
        else:
            _logger.warning(
                "no draft account found matching given account holder code %s", account_holder_code
            )
        return request.redirect('/web#action=odoo_payments.action_create_or_view_adyen_account')
