# coding: utf-8

import logging
import dateutil.parser
import pytz

from werkzeug import urls
from hashlib import md5

from odoo import api, fields, models, _
from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.addons.payment_ebs.controllers.main import EbsController
from odoo.tools.float_utils import float_compare


_logger = logging.getLogger(__name__)


class AcquirerEbs(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(selection_add=[('ebs', 'EBS')])
    ebs_account_id = fields.Char('EBS Account ID', required_if_provider='ebs', groups='base.group_user')
    ebs_secret_key = fields.Char(
        'EBS Secret Key', required_if_provider="ebs", groups='base.group_user')

    def _get_feature_support(self):
        """Get advanced feature support by provider.

        Each provider should add its technical in the corresponding
        key for the following features:
            * fees: support payment fees computations
            * authorize: support authorizing payment (separates
                         authorization and capture)
            * tokenize: support saving payment data in a payment.tokenize
                        object
        """
        res = super(AcquirerEbs, self)._get_feature_support()
        res['fees'].append('ebs')
        return res

    @api.model
    def _get_ebs_urls(self):
        """ EBS URLS """
        return "https://secure.ebs.in/pg/ma/payment/request"

    @api.multi
    def ebs_compute_fees(self, amount, currency_id, country_id):
        """ Compute EBS fees.

            :param float amount: the amount to pay
            :param integer country_id: an ID of a res.country, or None. This is
                                       the customer's country, to be compared to
                                       the acquirer company country.
            :return float fees: computed fees
        """
        if not self.fees_active:
            return 0.0
        country = self.env['res.country'].browse(country_id)
        if country and self.company_id.country_id.id == country.id:
            percentage = self.fees_dom_var
            fixed = self.fees_dom_fixed
        else:
            percentage = self.fees_int_var
            fixed = self.fees_int_fixed
        fees = (percentage / 100.0 * amount + fixed) / (1 - percentage / 100.0)
        return fees

    @api.multi
    def _generate_secure_hash(self, values):
        value = []
        for k, v in sorted(values.items()):
            if v and k not in ['SecureHash']:
                value.append("{}".format(v))
        string = '|'.join(value)
        data_string = self.ebs_secret_key + "|" + string
        return md5(data_string.encode('utf-8')).hexdigest().upper()

    @api.multi
    def ebs_form_generate_values(self, values):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        ebs_tx_values = ({
            'channel': '0',
            'account_id': self.ebs_account_id,
            'reference_no': values.get('reference'),
            'amount': values.get('amount'),
            'mode': 'LIVE' if self.environment == 'prod' else 'TEST',
            'currency': 'INR',
            'description': 'payment from ecommerce',
            'return_url': urls.url_join(base_url, EbsController._return_url) + "?redirect_url=" + str(values.get('return_url')),
            'name': values.get('billing_partner_name'),
            'address': values.get('billing_partner_address'),
            'city': values.get('billing_partner_city'),
            'country': values.get('billing_partner_country').code,
            'postal_code': values.get('billing_partner_zip'),
            'phone': values.get('billing_partner_phone'),
            'email': values.get('billing_partner_email'),
            })

        ebs_tx_values['secure_hash'] = self._generate_secure_hash(ebs_tx_values)

        return ebs_tx_values

    @api.multi
    def ebs_get_form_action_url(self):
        return self._get_ebs_urls()


class TxEbs(models.Model):
    _inherit = 'payment.transaction'

    # --------------------------------------------------
    # FORM RELATED METHODS
    # --------------------------------------------------

    @api.model
    def _ebs_form_get_tx_from_data(self, data):
        reference, txn_id = data.get('MerchantRefNo'), data.get('TransactionID')
        if not reference:
            error_msg = _('EBS: received data with missing reference (%s) or txn_id (%s)') % (reference, txn_id)
            _logger.info(error_msg)
            raise ValidationError(error_msg)

        txs = self.env['payment.transaction'].search([('reference', '=', reference)])
        if not txs or len(txs) > 1:
            error_msg = 'EBS: received data for reference %s' % (reference)
            if not txs:
                error_msg += '; no order found'
            else:
                error_msg += '; multiple order found'
            _logger.info(error_msg)
            raise ValidationError(error_msg)
        return txs[0]

    @api.multi
    def _ebs_form_get_invalid_parameters(self, data):
        invalid_parameters = []
        if self.acquirer_reference and data.get('TransactionID') != self.acquirer_reference:
            invalid_parameters.append(('TransactionID', data.get('TransactionID'), self.acquirer_reference))
        # check what is buyed
        if float_compare(float(data.get('Amount', '0.0')), (self.amount), 2) != 0:
            invalid_parameters.append(('Amount', data.get('Amount'), '%.2f' % self.amount))  # mc_gross is amount + fees

        hashvalue = self.acquirer_id._generate_secure_hash(data)
        if data.get('SecureHash') != hashvalue:
            invalid_parameters.append(('secure_hash', data.get('SecureHash'), hashvalue))

        return invalid_parameters

    @api.multi
    def _ebs_form_validate(self, data):
        status = EbsController.payment_status.get(data.get('ResponseCode'))
        res = {
            'acquirer_reference': data.get('TransactionID'),
        }
        if status == 'success':
            _logger.info('Validated EBS payment for tx %s: set as done' % (self.reference))
            try:
                # dateutil and pytz don't recognize abbreviations PDT/PST
                tzinfos = {
                    'PST': -8 * 3600,
                    'PDT': -7 * 3600,
                }
                date = dateutil.parser.parse(data.get('DateCreated'), tzinfos=tzinfos).astimezone(pytz.utc)
            except:
                date = fields.Datetime.now()
            res.update(state='done', date=date)
            return self.write(res)
        elif status == 'failed':
            _logger.info('Received notification for EBS payment %s: set as cancel' % (self.reference))
            res.update(state='cancel', state_message=data.get('ResponseMessage'))
            return self.write(res)
        else:
            error = 'Received unrecognized status for EBS payment %s: %s, set as error' % (self.reference, status)
            _logger.info(error)
            res.update(state='error', state_message=error)
            return self.write(res)
