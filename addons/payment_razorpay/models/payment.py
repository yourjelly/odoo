# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import requests

from odoo import api, fields, models, _
from odoo.tools.float_utils import float_compare, float_repr, float_round
from odoo.addons.payment.models.payment_acquirer import ValidationError

_logger = logging.getLogger(__name__)


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(selection_add=[('razorpay', 'Razorpay')])
    razorpay_key_id = fields.Char(string='Key ID', required_if_provider='razorpay', groups='base.group_user')
    razorpay_key_secret = fields.Char(string='Key Secret', required_if_provider='razorpay', groups='base.group_user')
    send_sms_email = fields.Boolean(string='Payment via send sms/email',
                                    help='Payment using send link on registered contact number and on email address',
                                    groups='base.group_user')

    @api.multi
    def razorpay_form_generate_values(self, values):
        self.ensure_one()
        currency = self.env['res.currency'].sudo().browse(values['currency_id'])
        if currency != self.env.ref('base.INR'):
            raise ValidationError(_('Currency not supported by Razorpay'))
        values.update({
            'key': self.razorpay_key_id,
            'amount': float_repr(float_round(values.get('amount'), 2) * 100, 0),
            'name': values.get('partner_name'),
            'contact': values.get('partner_phone'),
            'email': values.get('partner_email'),
            'order_id': values.get('reference'),
            'send_sms_email': self.send_sms_email,
        })
        return values

    def razorpay_get_form_action_url(self):
        if self.send_sms_email:
            return '/payment/razorpay/feedback'

    def _format_razorpay_data(self):
        pending_msg = _('''<div>
<h3>Payment link is send to your registered contact number/email address.</h3>
<h4>You can do directly payment from payment link.</h4>
</div>''')
        return pending_msg

    @api.model
    def create(self, values):
        """ Hook in write to create a default pending_message, if send sms/email option set."""
        if values.get('provider') == 'razorpay' and values.get('send_sms_email'):
            values['pending_msg'] = self._format_razorpay_data()
        return super(PaymentAcquirer, self).create(values)

    @api.multi
    def write(self, values):
        """ Hook in write to create a default pending_message, if send sms/email option set. See create(). """
        if all(not acquirer.send_sms_email and acquirer.provider == 'razorpay' for acquirer in self) and values.get('send_sms_email'):
            values['pending_msg'] = self._format_razorpay_data()
        return super(PaymentAcquirer, self).write(values)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    @api.model
    def _create_razorpay_capture(self, data):
        payment_acquirer = self.env['payment.acquirer'].search([('provider', '=', 'razorpay')], limit=1)
        payment_url = "https://%s:%s@api.razorpay.com/v1/payments/%s" % (payment_acquirer.razorpay_key_id, payment_acquirer.razorpay_key_secret, data.get('payment_id'))
        try:
            payment_response = requests.get(payment_url)
            payment_response = payment_response.json()
        except Exception as e:
            raise e
        reference = payment_response.get('notes', {}).get('order_id', False)
        if reference:
            transaction = self.search([('reference', '=', reference)])
            capture_url = "https://%s:%s@api.razorpay.com/v1/payments/%s/capture" % (payment_acquirer.razorpay_key_id, payment_acquirer.razorpay_key_secret, data.get('payment_id'))
            charge_data = {'amount': int(transaction.amount * 100)}
            try:
                payment_response = requests.post(capture_url, data=charge_data)
                payment_response = payment_response.json()
            except Exception as e:
                raise e
        return payment_response

    @api.model
    def _create_razorpay_notify(self, data):
        invoice_id = data.get('payload', {}).get('payment', {}).get('entity', {}).get('invoice_id', False)
        status = data.get('payload', {}).get('payment', {}).get('entity', {}).get('status', False)
        order_id = data.get('payload', {}).get('order', {}).get('entity', {}).get('id', False)
        TX = self.env['payment.transaction']
        if invoice_id and status in "captured":
            TX = TX.sudo().search([('acquirer_reference', '=', invoice_id)])
            if TX:
                TX.sudo().write({'state': 'done'})
        return TX

    @api.model
    def _razorpay_form_get_tx_from_data(self, data):
        payment_acquirer = self.env['payment.acquirer'].search([('provider', '=', 'razorpay')], limit=1)
        if payment_acquirer.send_sms_email:
            tx = self.env['payment.transaction'].search([('reference', '=', data.get('order_id'))])

            if not tx or len(tx) > 1:
                error_msg = _('received data for reference %s') % (pprint.pformat(reference))
                if not tx:
                    error_msg += _('; no order found')
                else:
                    error_msg += _('; multiple order found')
                _logger.info(error_msg)
                raise ValidationError(error_msg)

            return tx
        reference, txn_id = data.get('notes', {}).get('order_id'), data.get('id')
        if not reference or not txn_id:
            error_msg = _('Razorpay: received data with missing reference (%s) or txn_id (%s)') % (reference, txn_id)
            _logger.info(error_msg)
            raise ValidationError(error_msg)

        txs = self.env['payment.transaction'].search([('reference', '=', reference)])
        if not txs or len(txs) > 1:
            error_msg = 'Razorpay: received data for reference %s' % (reference)
            if not txs:
                error_msg += '; no order found'
            else:
                error_msg += '; multiple order found'
            _logger.info(error_msg)
            raise ValidationError(error_msg)
        return txs[0]

    @api.multi
    def _razorpay_form_get_invalid_parameters(self, data):
        invalid_parameters = []
        if float_compare(float(data.get('amount', '0.0')) / 100, self.amount, precision_digits=2) != 0:
            invalid_parameters.append(('amount', data.get('amount'), '%.2f' % self.amount))
        return invalid_parameters

    @api.model
    def _razorpay_create_customer(self):
        razorpay_key_id = self.acquirer_id.razorpay_key_id
        razorpay_key_secret = self.acquirer_id.razorpay_key_secret
        url = "https://%s:%s@api.razorpay.com/v1/customers" % (razorpay_key_id, razorpay_key_secret)
        data = dict(
                name=self.partner_id.name,
                contact=self.partner_id.phone,
                email=self.partner_id.email,
                fail_existing=0
            )
        try:
            response = requests.post(url, data=data).text
        except Exception as e:
            raise e
        return json.loads(response)

    @api.model
    def _razorpay_send_payment_link(self, customer_details):
        razorpay_key_id = self.acquirer_id.razorpay_key_id
        razorpay_key_secret = self.acquirer_id.razorpay_key_secret
        url = "https://%s:%s@api.razorpay.com/v1/invoices" % (razorpay_key_id, razorpay_key_secret)
        data = dict(
            type='link',
            amount= float_repr(float_round(self.amount, 2) * 100, 0), # Razorpay always need amount in integer
            currency="INR",  # orders.currency_id.name,
            description="Payment", #improve desctiption -> sale order info + customer name + from odoo
            customer_id=customer_details.get('id'),
        )
        data.update({"notes[order_id]": self.reference})
        try:
            response = requests.post(url, data=data).text
        except Exception as e:
            raise e
        return json.loads(response)

    @api.multi
    def _razorpay_form_validate(self, data):
        status = data.get('status')
        if data.get('send_sms_email') and not status:
            res_customer = self._razorpay_create_customer()
            res_payment = self._razorpay_send_payment_link(res_customer)
            _logger.info('Validated Razorpay payment for tx %s: set as pending' % (self.reference))
            self.write({'acquirer_reference': res_payment.get('id')})
            self._set_transaction_pending()
            return True
        if status == 'captured':
            _logger.info('Validated Razorpay payment for tx %s: set as done' % (self.reference))
            self.write({'acquirer_reference': data.get('id')})
            self._set_transaction_done()
            return True
        if status == 'authorized':
            _logger.info('Validated Razorpay payment for tx %s: set as authorized' % (self.reference))
            self.write({'acquirer_reference': data.get('id')})
            self._set_transaction_authorized()
            return True
        else:
            error = 'Received unrecognized status for Razorpay payment %s: %s, set as error' % (self.reference, status)
            _logger.info(error)
            self.write({'acquirer_reference': data.get('id'), 'state_message': data.get('error')})
            self._set_transaction_cancel()
            return False
