# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests

from lxml import etree
from hashlib import new as hashnew
from werkzeug.urls import url_join

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError, UserError

from odoo.addons.payment_asiapay import const


_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('asiapay', "AsiaPay")], ondelete={'asiapay': 'set default'}
    )
    asiapay_api_login_id = fields.Char(
        string="AsiaPay API Login ID",
        help="The API Login ID associated to your AsiaPay account.",
        groups='base.group_system',
    )
    asiapay_api_password = fields.Char(
        string="AsiaPay API Password",
        help="The API Password associated to your AsiaPay account.",
        groups='base.group_system',
    )
    asiapay_brand = fields.Selection(
        string="Asiapay Brand",
        help="The brand associated to your AsiaPay account.",
        selection=[("paydollar", "PayDollar"), ("pesopay", "PesoPay"),
                   ("siampay", "SiamPay"), ("bimopay", "BimoPay")],
        default='paydollar',
        required_if_provider='asiapay',
    )
    asiapay_merchant_id = fields.Char(
        string="AsiaPay Merchant ID",
        help="The Merchant ID solely used to identify your AsiaPay account.",
        required_if_provider='asiapay',
    )
    asiapay_secure_hash_secret = fields.Char(
        string="AsiaPay Secure Hash Secret",
        required_if_provider='asiapay',
        groups='base.group_system',
    )
    asiapay_secure_hash_function = fields.Selection(
        string="AsiaPay Secure Hash Function",
        help="The secure hash function associated to your AsiaPay account.",
        selection=[('sha1', "SHA1"), ('sha256', "SHA256"), ('sha512', 'SHA512')],
        default='sha1',
        required_if_provider='asiapay',
    )
    asiapay_tokenization_key = fields.Char(
        string="AsiaPay Tokenization Key",
        help="The Tokenization Key associated to your AsiaPay account.",
        groups='base.group_system',
    )
    asiapay_tokenization_salt = fields.Char(
        string="AsiaPay Tokenization Salt",
        help="The Tokenization Salt associated to your AsiaPay account.",
        groups='base.group_system',
    )

    #=== COMPUTE METHODS ===#

    @api.depends('code')
    def _compute_view_configuration_fields(self):
        """ Override of payment to make the `available_currency_ids` field required.

        :return: None
        """
        super()._compute_view_configuration_fields()
        self.filtered(lambda p: p.code == 'asiapay').update({
            'require_currency': True,
        })

    def _compute_feature_support_fields(self):
        """ Override of `payment` to enable additional features. """
        super()._compute_feature_support_fields()
        self.filtered(lambda p: p.code == 'asiapay').update({
            'support_express_checkout': False,
            'support_manual_capture': 'partial',
            'support_refund': 'partial',
            'support_tokenization': True,
        })

    # ==== CONSTRAINT METHODS ===#

    @api.constrains('available_currency_ids', 'state')
    def _limit_available_currency_ids(self):
        for provider in self.filtered(lambda p: p.code == 'asiapay'):
            if len(provider.available_currency_ids) > 1 and provider.state != 'disabled':
                raise ValidationError(_("Only one currency can be selected by AsiaPay account."))

    # === BUSINESS METHODS ===#

    def _asiapay_get_api_url(self):
        """ Return the URL of the API corresponding to the provider's state.

        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()

        environment = 'production' if self.state == 'enabled' else 'test'
        api_urls = const.API_URLS[environment]
        return api_urls.get(self.asiapay_brand, api_urls['paydollar'])

    # === BUSINESS METHODS - PAYMENT FLOW === #

    def _asiapay_make_request(
        self, endpoint, action_type, payload=None, method='POST'
    ):
        """ Make a request to Asiapay API at the specified endpoint.

        Note: self.ensure_one()

        :param str endpoint: The endpoint to be reached by the request
        :param dict payload: The payload of the request
        :param str method: The HTTP method of the request
        :param bool offline: Whether the operation of the transaction being processed is 'offline'
        :return The JSON-formatted content of the response
        :rtype: dict
        :raise: ValidationError if an HTTP error occurs
        """
        def default_tuple(attr, value=False):
            return attr, value

        def is_xml_response(response):
            return response.headers.get('Content-Type', '').startswith('text/xml')

        self.ensure_one()

        if not self.asiapay_api_login_id or not self.asiapay_api_password:
            raise UserError(_("The AsiaPay API credentials are not configured."))

        api_url = self._asiapay_get_api_url()
        url = url_join(api_url, url_join('merchant/api/', endpoint))
        form_data = {
            'merchantId': self.asiapay_merchant_id,
            'loginId': self.asiapay_api_login_id,
            'password': self.asiapay_api_password,
            'actionType': action_type,
            **payload,
        }
        try:
            response = requests.request(method, url, data=form_data, timeout=60)
            if is_xml_response(response):
                data = {}
                try:
                    xml_tree = etree.fromstring(response.content)
                    if action_type == 'Query':
                        # The response of the Query action can only contain one record
                        record = next(iter(xml_tree.findall('record') or []), None)
                        data = {node.tag: node.text for node in record.iterchildren()} if record is not None else {}
                    else:
                        for node in xml_tree.iterchildren():
                            if node.tag in ['responsestatus', 'response']:
                                for child in node:
                                    data[child.tag] = child.text
                        if data.get('responsecode') == '-1':
                            _logger.error("invalid API request at %s with data %s\n"
                                        "response data %s", url, form_data, data)
                            raise ValidationError(
                                "AsiaPay: " + _("The communication with the API failed.\n"
                                                "AsiaPay gave us the following info about the problem:\n'%s'", data.get('responsemessage', ''))
                            )
                except etree.XMLSyntaxError:
                    _logger.exception("unable to parse XML response from %s", url)
                    raise ValidationError("Asiapay: " + _("The response from the API is not valid."))
            else:
                data = dict(default_tuple(*pair.split('=', 1)) for pair in response.text.split('&'))
                if data.get('resultCode') == '-1' or ('resultCode' not in data and data.get('errMsg')):
                    _logger.error("invalid API request at %s with data %s\n"
                                "response data %s", url, form_data, data)
                    raise ValidationError(
                        "AsiaPay: " + _("The communication with the API failed.\n"
                                        "AsiaPay gave us the following info about the problem:\n'%s'", data.get('errMsg', '').replace('\r\n', ''))
                    )
            return data
        except requests.exceptions.ConnectionError:
            _logger.exception("unable to reach endpoint at %s", url)
            raise ValidationError("Asiapay: " + _("Could not establish the connection to the API."))

    def _asiapay_calculate_signature(self, data, incoming=True):
        """ Compute the signature for the provided data according to the AsiaPay documentation.

        :param dict data: The data to sign.
        :param bool incoming: Whether the signature must be generated for an incoming (AsiaPay to
                              Odoo) or outgoing (Odoo to AsiaPay) communication.
        :return: The calculated signature.
        :rtype: str
        """
        signature_keys = const.SIGNATURE_KEYS['incoming' if incoming else 'outgoing']
        data_to_sign = [str(data[k]) for k in signature_keys] + [self.asiapay_secure_hash_secret]
        signing_string = '|'.join(data_to_sign)
        shasign = hashnew(self.asiapay_secure_hash_function)
        shasign.update(signing_string.encode())
        return shasign.hexdigest()
