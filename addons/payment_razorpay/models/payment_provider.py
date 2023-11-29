# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hashlib
import hmac
import logging
import pprint

import requests
from werkzeug.urls import url_join,url_encode

from odoo import _, fields, models, api
from odoo.exceptions import ValidationError

from odoo.addons.payment_razorpay import const
from odoo.addons.payment_razorpay.controllers.main import RazorpayController
from odoo.addons.payment_razorpay import const, utils as razorpay_utils
from odoo.addons.payment_razorpay.controllers.onboarding import OnboardingController


_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('razorpay', "Razorpay")], ondelete={'razorpay': 'set default'}
    )
    razorpay_key_id = fields.Char(
        string="Razorpay Key Id",
        help="The key solely used to identify the account with Razorpay.",
        required_if_provider='razorpay',
    )
    razorpay_key_secret = fields.Char(
        string="Razorpay Key Secret",
        required_if_provider='razorpay',
        groups='base.group_system',
    )
    razorpay_webhook_secret = fields.Char(
        string="Razorpay Webhook Secret",
        required_if_provider='razorpay',
        groups='base.group_system',
    )

    #=== COMPUTE METHODS ===#

    def _compute_feature_support_fields(self):
        """ Override of `payment` to enable additional features. """
        super()._compute_feature_support_fields()
        self.filtered(lambda p: p.code == 'razorpay').update({
            'support_manual_capture': 'full_only',
            'support_refund': 'partial',
            'support_tokenization': True,
        })

    #=== CONSTRAINT METHODS ===#

    @api.constrains('state', 'razorpay_key_id', 'razorpay_key_secret')
    def _check_state_of_connected_account_is_never_test(self):
        """ Check that the provider of a connected account can never been set to 'test'.

        This constraint is defined in the present module to allow the export of the translation
        string of the `ValidationError` should it be raised by modules that would fully implement
        Razorpay Connect.

        Additionally, the field `state` is used as a trigger for this constraint to allow those
        modules to indirectly trigger it when writing on custom fields. Indeed, by always writing on
        `state` together with writing on those custom fields, the constraint would be triggered.

        :return: None
        :raise ValidationError: If the provider of a connected account is set in state 'test'.
        """

        for provider in self:
            if provider.state == 'test' and provider._razorpay_has_connected_account():
                raise ValidationError(_(
                    "You cannot set the provider to Test Mode while it is linked with your Razorpay "
                    "account."
                ))

    def _razorpay_has_connected_account(self):
        """ Return whether the provider is linked to a connected Razorpay account.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.
        Note: self.ensure_one()

        :return: Whether the provider is linked to a connected Razorpay account
        :rtype: bool
        """
        self.ensure_one()
        return False

    @api.constrains('state')
    def _check_onboarding_of_enabled_provider_is_completed(self):
        """ Check that the provider cannot be set to 'enabled' if the onboarding is ongoing.

        This constraint is defined in the present module to allow the export of the translation
        string of the `ValidationError` should it be raised by modules that would fully implement
        Razorpay Connect.

        :return: None
        :raise ValidationError: If the provider of a connected account is set in state 'enabled'
                                while the onboarding is not finished.
        """
        for provider in self:
            if provider.state == 'enabled' and provider._razorpay_onboarding_is_ongoing():
                raise ValidationError(_(
                    "You cannot set the provider state to Enabled until your onboarding to Razorpay "
                    "is completed."
                ))

    def _razorpay_onboarding_is_ongoing(self):
        """ Return whether the provider is linked to an ongoing onboarding to Razorpay Connect.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.
        Note: self.ensure_one()

        :return: Whether the provider is linked to an ongoing onboarding to Razorpay Connect
        :rtype: bool
        """
        self.ensure_one()
        return False

    # === BUSINESS METHODS ===#

    def _get_supported_currencies(self):
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'razorpay':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _razorpay_make_request(self, endpoint, payload=None, method='POST'):
        """ Make a request to Razorpay API at the specified endpoint.

        Note: self.ensure_one()

        :param str endpoint: The endpoint to be reached by the request.
        :param dict payload: The payload of the request.
        :param str method: The HTTP method of the request.
        :return The JSON-formatted content of the response.
        :rtype: dict
        :raise ValidationError: If an HTTP error occurs.
        """
        self.ensure_one()

        url = url_join('https://api.razorpay.com/v2/', endpoint)
        auth = (self.razorpay_key_id, self.razorpay_key_secret)
        try:
            if method == 'GET':
                response = requests.get(url, params=payload, auth=auth, timeout=10)
            else:
                response = requests.post(url, json=payload, auth=auth, timeout=10)
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError:
                _logger.exception(
                    "Invalid API request at %s with data:\n%s", url, pprint.pformat(payload),
                )
                raise ValidationError("Razorpay: " + _(
                    "Razorpay gave us the following information: '%s'",
                    response.json().get('error', {}).get('description')
                ))
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("Unable to reach endpoint at %s", url)
            raise ValidationError(
                "Razorpay: " + _("Could not establish the connection to the API.")
            )
        return response.json()

        # url = url_join('https://api.razorpay.com/v2/', endpoint)
        # razorpay_key_id="rzp_test_JPQACjlFCPxYvn"
        # razorpay_key_secret="8wLN8srY3pdH6fWhRh8Vqhgu"
        # auth = (razorpay_key_id, razorpay_key_secret)
        # headers = {
        #     'AUTHORIZATION': f'Bearer {razorpay_utils.get_secret_key(self)}',
        #     **self._get_razorpay_extra_request_headers(),
        # }
        # if method == 'POST':
        #         try:
        #             response = requests.post(url, params=payload, auth=auth, timeout=10)
        #             if not response.ok \
        #                 and not offline \
        #                 and 400 <= response.status_code < 500 \
        #                 and response.json().get('error'):  # The 'code' entry is sometimes missing
        #                 try:
        #                     response.raise_for_status()
        #                 except requests.exceptions.HTTPError:
        #                     _logger.exception(
        #                         "Invalid API request at %s with data:\n%s", url, pprint.pformat(payload),
        #                     )
        #                     raise ValidationError("Razorpay: " + _(
        #                         "The communication with the API failed. Razorpay gave us the following "
        #                         "information: '%s'", response.json().get('error', {}).get('description')
        #                     ))
        #         except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        #             _logger.exception("Unable to reach endpoint at %s", url)
        #             raise ValidationError(
        #                 "Razorpay: " + _("Could not establish the connection to the API.")
        #             )
        #         print("Response : ",response.json())
        #         return response.json()

    def _razorpay_calculate_signature(self, data, is_redirect=True):
        """ Compute the signature for the request's data according to the Razorpay documentation.

        See https://razorpay.com/docs/webhooks/validate-test#validate-webhooks and
        https://razorpay.com/docs/payments/payment-gateway/web-integration/hosted/build-integration.

        :param dict|bytes data: The data to sign.
        :param bool is_redirect: Whether the data should be treated as redirect data or as coming
                                 from a webhook notification.
        :return: The calculated signature.
        :rtype: str
        """
        if is_redirect:
            secret = self.razorpay_key_secret
            signing_string = f'{data["razorpay_order_id"]}|{data["razorpay_payment_id"]}'
            return hmac.new(
                secret.encode(), msg=signing_string.encode(), digestmod=hashlib.sha256
            ).hexdigest()
        else:  # Notification data.
            secret = self.razorpay_webhook_secret
            return hmac.new(secret.encode(), msg=data, digestmod=hashlib.sha256).hexdigest()

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != 'razorpay':
            return default_codes
        return const.DEFAULT_PAYMENT_METHODS_CODES

    def _get_validation_amount(self):
        """ Override of `payment` to return the amount for Razorpay validation operations.

        :return: The validation amount.
        :rtype: float
        """
        res = super()._get_validation_amount()
        if self.code != 'razorpay':
            return res

        return 1.0

    def _get_razorpay_extra_request_headers(self):
        """ Return the extra headers for the Razorpay API request.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The extra request headers.
        :rtype: dict
        """
        return {}

    # === ACTION METHODS === #

    def action_razorpay_connect_account(self, menu_id=None):
        """ Create a Razorpay Connect account and redirect the user to the next onboarding step.

        If the provider is already enabled, close the current window. Otherwise, generate a Razorpay
        Connect onboarding link and redirect the user to it. If provided, the menu id is included in
        the URL the user is redirected to when coming back on Odoo after the onboarding. If the link
        generation failed, redirect the user to the provider form.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.
        Note: self.ensure_one()

        :param int menu_id: The menu from which the user started the onboarding step, as an
                            `ir.ui.menu` id.
        :return: The next step action
        :rtype: dict
        """
        self.ensure_one()

        if self.state == 'enabled':
            self.env['onboarding.onboarding.step'].action_validate_step_payment_provider()
            action = {'type': 'ir.actions.act_window_close'}
        else:
            # Account creation
            account_res = self._razorpay_fetch_or_create_connected_account()
            if account_res.get('status') == 'created':
                account_id = account_res.get('id')
                fetch_account = self._razorpay_fetch_account(account_id)
                update_account = self._razorpay_update_account_action(account_id)
                delete_account = self._razorpay_delete_account_action(account_id)

                # Product Configuration
                product_res =  self._request_product_configuration(account_id)
                product_id = product_res.get('id')
                fetch_product = self._fetch_product_configuration(account_id, product_id)
                update_settlement_account_details = self._update_settlement_account_details(account_id, product_id)
                payment_req = self._request_payment(account_id, product_id)

                # Stakeholder Creation
                stakeholder_res = self._razorpay_create_stakeholder_account(account_id)
                if stakeholder_res.get('status') == 'created':
                    stakeholder_id = stakeholder_res.get('id')
                    fetch_stakeholder = self._razorpay_fetch_stakeholder_account_action(account_id)
                    fetch_all_stakeholder = self._razorpay_fetch_all_stakeholder_account(account_id)

                # Terms & Condition
                terms_condi_res = self._fetch_terms_and_conditions(product_res.get('product_name'))

                # Documents
                upload_account_doc = self._upload_account_documents(account_id)
                upload_stakeholder_doc = self._upload_stakeholder_documents(account_id, stakeholder_id)
                fetch_acc_doc = self._Fetch_account_documents(account_id)
                fetch_stakeholder_doc = self._upload_stakeholder_documents(account_id, stakeholder_id)

            # # Link generation
            # if not menu_id:
            #     # Fall back on `account_payment`'s menu if it is installed. If not, the user is
            #     # redirected to the provider's form view but without any menu in the breadcrumb.
            #     menu = self.env.ref('account_payment.payment_provider_menu', False)
            #     menu_id = menu and menu.id  # Only set if `account_payment` is installed.

            # account_link_url = self._razorpay_create_account_link(connected_account['id'], menu_id)
            # print("\n\n..........................................",account_link_url)
            # if account_link_url:
            #     action = {
            #         'type': 'ir.actions.act_url',
            #         'url': account_link_url,
            #         'target': 'self',
            #     }
            # else:
            #     action = {
            #         'type': 'ir.actions.act_window',
            #         'model': 'payment.provider',
            #         'views': [[False, 'form']],
            #         'res_id': self.id,
            #     }

        return action

    # def _razorpay_create_account_link(self, connected_account_id, menu_id):
    #     """ Create an account link and return its URL.

    #     An account link url is the beginning URL of Razorpay Onboarding.
    #     This URL is only valid once, and can only be used once.

    #     Note: self.ensure_one()

    #     :param str connected_account_id: The id of the connected account.
    #     :param int menu_id: The menu from which the user started the onboarding step, as an
    #                         `ir.ui.menu` id
    #     :return: The account link URL
    #     :rtype: str
    #     """
    #     self.ensure_one()

    #     base_url = self.company_id.get_base_url()
    #     return_url = OnboardingController._onboarding_return_url
    #     refresh_url = OnboardingController._onboarding_refresh_url
    #     return_params = dict(provider_id=self.id, menu_id=menu_id)
    #     refresh_params = dict(**return_params, account_id=connected_account_id)

    #     account_link = self._razorpay_make_request('account_links', payload={
    #         'account': connected_account_id,
    #         'return_url': f'{url_join(base_url, return_url)}?{url_encode(return_params)}',
    #         'refresh_url': f'{url_join(base_url, refresh_url)}?{url_encode(refresh_params)}',
    #         'type': 'account_onboarding',
    #     })
    #     return account_link['url']

    ### CREATE ACCOUNT APIS ###

    def _razorpay_fetch_or_create_connected_account(self):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        return self._razorpay_make_request(
            'accounts', payload=self._razorpay_prepare_connect_account_payload()
        )

    # === BUSINESS METHODS - RAZORPAY CONNECT ONBOARDING === #

    def _razorpay_fetch_account(self, account_id):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        return self._razorpay_make_request(
            'accounts/:account_id', account_id
        )

    def _razorpay_delete_account_action(self, account_id):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        return self._razorpay_make_request(
            'accounts/:account_id', account_id
        )

    def _razorpay_update_account_action(self, account_id):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        return self._razorpay_make_request(
            'accounts/:account_id', account_id,{
                "customer_facing_business_name": self.company_id.name
            }
        )

    def _razorpay_prepare_connect_account_payload(self):
            """ Prepare the payload for the creation of a connected account in Razorpay format.

            Note: This method serves as a hook for modules that would fully implement Razorpay Connect.
            Note: self.ensure_one()

            :return: The Razorpay-formatted payload for the creation request
            :rtype: dict
            """
            self.ensure_one()

            return {
                'email': self.company_id.email,
                'phone': self.company_id.phone,
                'business_type': 'individual',
                'legal_business_name': self.company_id.name,
                'profile[category]': self.company_id.partner_id.category_id.ids,
                # 'profile[subcategory]': self.company_id.category_id,
                'legal_info[gst]': self.company_id.vat,
                'company[address][city]': self.company_id.city or '',
                'company[address][country]': self.company_id.country_id.code or '',
                'company[address][line1]': self.company_id.street or '',
                'company[address][postal_code]': self.company_id.zip or '',
                'company[address][state]': self.company_id.state_id.name or '',
                'company[contact_name]': self.company_id.name,
                # 'individual[address][city]': self.company_id.city or '',
                # 'individual[address][country]': self.company_id.country_id.code or '',
                # 'individual[address][line1]': self.company_id.street or '',
                # 'individual[address][postal_code]': self.company_id.zip or '',
                # 'individual[address][state]': self.company_id.state_id.name or '',
                # 'individual[email]': self.company_id.email or '',
        }

    ### STAKEHOLDER APIS ###

    def _razorpay_create_stakeholder_account(self, account_id):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        print("\n\nrazorpay create stackholder account action method is called...")
        return self._razorpay_make_request(
            'accounts/:account_id/stakeholders', account_id, {
                'name': self.company_id.name,
                'email': self.company_id.email or '',
                'percentage_ownership' : '50 %',
                'phone': self.company_id.phone or '',
                'company[address][city]': self.company_id.city or '',
                'company[address][country]': self.company_id.country_id.code or '',
                'company[address][line1]': self.company_id.street or '',
                'company[address][postal_code]': self.company_id.zip or '',
                'company[address][state]': self.company_id.state_id.name or '',
            }
        )

    def _razorpay_fetch_stakeholder_account_action(self, account_id):
        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        print("\n\nrazorpay fetch stackholder account action method is called...")
        return self._razorpay_make_request(
            'accounts/:account_id/stakeholders/:stakeholder_id', account_id
        )

    def _razorpay_fetch_all_stakeholder_account(self, account_id):

        print("\n\nrazorpay fetch stackholder account action method is called...")
        return self._razorpay_make_request(
            'accounts/:account_id/stakeholders', account_id, {
                'name': self.company_id.name
            }
        )

    def _razorpay_update_stakeholder_account(self, account_id, id):
        print("\n\nrazorpay update stakeholder account method is called...")
        return self._razorpay_make_request(
            'accounts/:account_id/stakeholders/:stakeholder_id', account_id, id, {
                'name': self.company_id.name
            }
        )

    ### PRODUCT CONFIGURATOR APIS ###

    def _request_product_configuration(self, account_id):

        product_name = "payment_gateway"

        """ Fetch the connected Razorpay account and create one if not already done.

        Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

        :return: The connected account
        :rtype: dict
        """
        print("\n\n request razorpay product configuration...")
        return self._razorpay_make_request(
            'accounts/:account_id/products', account_id, {
                "product_name": product_name,
            }
        )

    def _fetch_product_configuration(self, account_id, product_id):

        print("\n\nFetch Product configuration....")
        return self._razorpay_make_request(
            'accounts/:account_id/products/:product_id', account_id, product_id, payload=None
        )

    def _update_settlement_account_details(self, account_id, product_id):

        print("\n\nUpdate Settlement Account Details....")
        return self._razorpay_make_request(
            'accounts/:account_id/products/:product_id', account_id, product_id, payload=None
        )

    def _request_payment(self, account_id, product_id):

        print("\n\nRequest Payment Methods....")
        return self._razorpay_make_request(
            'accounts/:account_id/products/:product_id', account_id, product_id, payload=None
        )

    ### DOCUMENTS APIS ###

    def _upload_account_documents(self, account_id):

        return self._razorpay_make_request(
            'accounts/:account_id/documents',account_id, {
                "file" : "file like document file ",
                "document_type" : "business_proof_url"
            }
        )

    def _upload_stakeholder_documents(self, account_id, stakeholder_id):
        return self._razorpay_make_request(
            'accounts/:account_id/documents',account_id, stakeholder_id, payload={
                "file" : "file like document file ",
                "document_type" : "business_proof_url"
            }
        )

    def _Fetch_account_documents(self, account_id):
        return self._razorpay_make_request(
            'accounts/:account_id/documents', account_id
        )

    def _upload_stakeholder_documents(self, account_id, stakeholder_id):
        return self._razorpay_make_request(
            'accounts/:account_id/stakeholders/:stakeholder_id/documents', account_id, stakeholder_id, payload=None
        )

    ### WEBHOOK APIS ###

    def action_razorpay_create_webhook(self):
        """ Create a webhook and return a feedback notification.

        Note: This action only works for instances using a public URL

        :return: The feedback notification
        :rtype: dict
        """
        self.ensure_one()

        if self.razorpay_webhook_secret:
            message = _("Your Razorpay Webhook is already set up.")
            notification_type = 'warning'
        elif not self.razorpay_key_secret:
            message = _("You cannot create a Razorpay Webhook if your Razorpay Secret Key is not set.")
            notification_type = 'danger'
        else:
            webhook = self._razorpay_make_request(
                'accounts/:account_id/webhooks', payload={
                    'url': self._get_razorpay_webhook_url(),
                    'enabled_events[]': const.HANDLED_WEBHOOK_EVENTS,
                }
            )
            self.razorpay_webhook_secret = webhook.get('secret')
            message = _("You Razorpay Webhook was successfully set up!")
            notification_type = 'info'

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'message': message,
                'sticky': False,
                'type': notification_type,
                'next': {'type': 'ir.actions.act_window_close'},  # Refresh the form to show the key
            }
        }

    def _get_razorpay_webhook_url(self):
        return url_join(self.get_base_url(), RazorpayController._webhook_url)

    def action_razorpay_fetch_data_webhook(self, account_id, webhook_id):
        """ Create a webhook and return a feedback notification.
        Note: This action only works for instances using a public URL

        :return: The feedback notification
        :rtype: dict
        """
        self.ensure_one()

        return self._razorpay_make_request(
            'accounts/:account_id/webhooks/:webhook_id', account_id, webhook_id, payload=None
        )

    # def action_razorpay_fetch_all_webhooks(self, account_id):

    #     self.ensure_one()

    #     return self._razorpay_make_request(
    #         'accounts/:account_id/webhooks', payload={
    #             'url': self._get_razorpay_webhook_url(),
    #             'enabled_events[]': const.HANDLED_WEBHOOK_EVENTS,
    #         }
    #     )

    def update_webhook(self, account_id, webhook_id):
        self.ensure_one()

        return self._razorpay_make_request(
            'accounts/:account_id/webhooks/:webhook_id',account_id, webhook_id, payload={
                'url': self._get_razorpay_webhook_url(),
                'enabled_events[]': const.HANDLED_WEBHOOK_EVENTS,
            }
        )

    def delete_webhook(self, account_id, webhook_id):
        self.ensure_one()

        return self._razorpay_make_request(
            'accounts/:account_id/webhooks/:webhook_id',account_id, webhook_id, payload=None
        )

    ### Terms and Condition APIs ###

    def _fetch_terms_and_conditions(self, product_name):
        self.ensure_one()

        return self._razorpay_make_request(
            'products/:product_name/tnc', product_name
        )

