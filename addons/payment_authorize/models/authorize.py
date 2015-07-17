# -*- coding: utf-'8' "-*-"
from authorize_request import AuthhorizeRequest
import hashlib
import hmac
import logging
import time
import urlparse

from openerp import api, fields, models
from openerp.addons.payment.models.payment_acquirer import ValidationError
from openerp.addons.payment_authorize.controllers.main import AuthorizeController
from openerp.tools.float_utils import float_compare

_logger = logging.getLogger(__name__)


class PaymentAcquirerAuthorize(models.Model):
    _inherit = 'payment.acquirer'

    def _get_authorize_urls(self, environment):
        """ Authorize URLs """
        if environment == 'prod':
            return {'authorize_form_url': 'https://secure.authorize.net/gateway/transact.dll'}
        else:
            return {'authorize_form_url': 'https://test.authorize.net/gateway/transact.dll'}

    @api.model
    def _get_providers(self):
        providers = super(PaymentAcquirerAuthorize, self)._get_providers()
        providers.append(['authorize', 'Authorize.Net'])
        return providers

    authorize_login = fields.Char(string='API Login Id', required_if_provider='authorize')
    authorize_transaction_key = fields.Char(string='API Transaction Key', required_if_provider='authorize')

    def _authorize_generate_hashing(self, values):
        data = '^'.join([
            values['x_login'],
            values['x_fp_sequence'],
            values['x_fp_timestamp'],
            values['x_amount'],
            values['x_currency_code']])
        return hmac.new(str(values['x_trans_key']), data, hashlib.md5).hexdigest()

    @api.multi
    def authorize_form_generate_values(self, partner_values, tx_values):
        self.ensure_one()
        base_url = self.env['ir.config_parameter'].get_param('web.base.url')
        authorize_tx_values = dict(tx_values)
        temp_authorize_tx_values = {
            'x_login': self.authorize_login,
            'x_trans_key': self.authorize_transaction_key,
            'x_amount': str(tx_values['amount']),
            'x_show_form': 'PAYMENT_FORM',
            'x_type': 'AUTH_CAPTURE',
            'x_method': 'CC',
            'x_fp_sequence': '%s%s' % (self.id, int(time.time())),
            'x_version': '3.1',
            'x_relay_response': 'TRUE',
            'x_fp_timestamp': str(int(time.time())),
            'x_relay_url': '%s' % urlparse.urljoin(base_url, AuthorizeController._return_url),
            'x_cancel_url': '%s' % urlparse.urljoin(base_url, AuthorizeController._cancel_url),
            'x_currency_code': tx_values['currency'] and tx_values['currency'].name or '',
            'address': partner_values['address'],
            'city': partner_values['city'],
            'country': partner_values['country'] and partner_values['country'].name or '',
            'email': partner_values['email'],
            'zip': partner_values['zip'],
            'first_name': partner_values['first_name'],
            'last_name': partner_values['last_name'],
            'phone': partner_values['phone'],
            'state': partner_values.get('state') and partner_values['state'].name or '',
        }
        temp_authorize_tx_values['returndata'] = authorize_tx_values.pop('return_url', '')
        temp_authorize_tx_values['x_fp_hash'] = self._authorize_generate_hashing(temp_authorize_tx_values)
        authorize_tx_values.update(temp_authorize_tx_values)
        return partner_values, authorize_tx_values

    @api.multi
    def authorize_get_form_action_url(self):
        self.ensure_one()
        return self._get_authorize_urls(self.environment)['authorize_form_url']

    @api.model
    def authorize_s2s_form_process(self, data):
        values = {
            'cc_number': data.get('cc_number'),
            'cc_holder_name': data.get('cc_holder_name'),
            'cc_expiry': data.get('cc_expiry'),
            'cc_cvv': data.get('cc_cvv'),
            'cc_brand': data.get('cc_brand'),
            'acquirer_id': int(data.get('acquirer_id')),
            'partner_id': int(data.get('partner_id'))
        }
        pm = self.env['payment.method'].sudo().create(values)
        return pm.id

    @api.multi
    def authorize_s2s_form_validate(self, data):
        error = dict()
        mandatory_fields = ["cc_number", "cc_cvc", "cc_holder_name", "cc_expiry", "cc_brand"]
        # Validation
        for field_name in mandatory_fields:
            if not data.get(field_name):
                error[field_name] = 'missing'
        return False if error else True

class TxAuthorize(models.Model):
    _inherit = 'payment.transaction'

    authorize_txnid = fields.Char(string='Transaction ID')

    _authorize_valid_tx_status = 1
    _authorize_pending_tx_status = 4
    _authorize_cancel_tx_status = 2

    # --------------------------------------------------
    # FORM RELATED METHODS
    # --------------------------------------------------

    @api.model
    def _authorize_form_get_tx_from_data(self, data):
        """ Given a data dict coming from authorize, verify it and find the related
        transaction record. """
        reference, trans_id, fingerprint = data.get('x_invoice_num'), data.get('x_trans_id'), data.get('x_MD5_Hash')
        if not reference or not trans_id or not fingerprint:
            error_msg = 'Authorize: received data with missing reference (%s) or trans_id (%s) or fingerprint (%s)' % (reference, trans_id, fingerprint)
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        tx = self.search([('reference', '=', reference)])
        if not tx or len(tx) > 1:
            error_msg = 'Authorize: received data for reference %s' % (reference)
            if not tx:
                error_msg += '; no order found'
            else:
                error_msg += '; multiple order found'
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        return tx[0]

    @api.model
    def _authorize_form_get_invalid_parameters(self, tx, data):
        invalid_parameters = []

        if tx.authorize_txnid and data.get('x_trans_id') != tx.authorize_txnid:
            invalid_parameters.append(('Transaction Id', data.get('x_trans_id'), tx.authorize_txnid))
        # check what is buyed
        if float_compare(float(data.get('x_amount', '0.0')), tx.amount, 2) != 0:
            invalid_parameters.append(('Amount', data.get('x_amount'), '%.2f' % tx.amount))
        return invalid_parameters

    @api.model
    def _authorize_form_validate(self, tx, data):
        if tx.state == 'done':
            _logger.warning('Authorize: trying to validate an already validated tx (ref %s)' % tx.reference)
            return True
        status_code = int(data.get('x_response_code', '0'))
        if status_code == self._authorize_valid_tx_status:
            tx.write({
                'state': 'done',
                'authorize_txnid': data.get('x_trans_id'),
                'acquirer_reference': data['x_invoice_num'],
            })
            return True
        elif status_code == self._authorize_pending_tx_status:
            tx.write({
                'state': 'pending',
                'authorize_txnid': data.get('x_trans_id'),
                'acquirer_reference': data['x_invoice_num'],
            })
            return True
        elif status_code == self._authorize_cancel_tx_status:
            tx.write({
                'state': 'cancel',
                'authorize_txnid': data.get('x_trans_id'),
                'acquirer_reference': data['x_invoice_num'],
            })
            return True
        else:
            error = data.get('x_response_reason_text')
            _logger.info(error)
            tx.write({
                'state': 'error',
                'state_message': error,
                'authorize_txnid': data.get('x_trans_id'),
                'acquirer_reference': data['x_invoice_num'],
            })
            return False

    @api.multi
    def authorize_s2s_do_transaction(self, data):
        self.ensure_one()
        payement_method = self.env['payment.method'].search([('partner_id', '=', self.partner_id.id), ('acquirer_id', '=', self.acquirer_id.id)], limit=1)
        transaction = AuthhorizeRequest(self.acquirer_id.environment, self.acquirer_id.authorize_login, self.acquirer_id.authorize_transaction_key)
        return transaction.create_authorize_s2s_transaction(payement_method.acquirer_ref, payement_method.authorize_payment_id, data['x_amount'], data['x_invoice_num'])

    @api.multi
    def _authorize_s2s_validate(self):
        self.ensure_one()
        tree = self._authorize_s2s_get_tx_status()
        return self.authorize_s2s_validate(tree)

    @api.model
    def _authorize_s2s_validate(self, tx, data):
        return self._authorize_form_validate(tx, data)

    @api.model
    def _authorize_s2s_get_tx_from_data(self, data):
        """ Given a data dict coming from authorize, verify it and find the related
        transaction record. """
        reference, trans_id = data.get('x_invoice_num'), data.get('x_trans_id')
        if not reference or not trans_id:
            error_msg = 'Authorize: received data with missing reference (%s) or trans_id (%s)' % (reference, trans_id)
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        tx = self.search([('reference', '=', reference)])
        if not tx or len(tx) > 1:
            error_msg = 'Authorize: received data for reference %s' % (reference)
            if not tx:
                error_msg += '; no order found'
            else:
                error_msg += '; multiple order found'
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        return tx[0]

    @api.model
    def _authorize_s2s_get_invalid_parameters(self, tx, data):
        return self._authorize_form_get_invalid_parameters(tx, data)


class PaymentMethod(models.Model):
    _inherit = 'payment.method'

    authorize_payment_id = fields.Char(string='Authorize Payment Reference')

    @api.model
    def authorize_create(self, values):
        if values.get('cc_number'):
            values['cc_number'] = values['cc_number'].replace(' ', '')
            acquirer = self.env['payment.acquirer'].browse(values['acquirer_id'])
            expiry = str(values['cc_expiry'][:2]) + str(values['cc_expiry'][-2:])
            self.customer = AuthhorizeRequest(acquirer.environment, acquirer.authorize_login, acquirer.authorize_transaction_key)
            payments = self.customer.create_authorize_s2s_payment(values['cc_number'], expiry)
            profile_id, payment_ids = self.customer.create_authorize_s2s_profile([payments], self.env.user.partner_id.email)

            return {
                'acquirer_ref': profile_id,
                'name': 'XXXXXXXXXXXX%s - %s' % (values['cc_number'][-4:], values['cc_holder_name']),
                'authorize_payment_id': payment_ids[0]
            }
        return {}
