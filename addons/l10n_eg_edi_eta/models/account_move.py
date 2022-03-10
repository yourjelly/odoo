# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import base64
import hashlib
import hmac
import time
from collections import defaultdict

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

from odoo.tools import formatLang
from odoo.tools.float_utils import float_compare, float_is_zero, float_round

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_eg_long_id = fields.Char('ETA Long ID', copy=False)
    l10n_eg_internal_id = fields.Char('ETA Internal ID', copy=False)
    l10n_eg_hash_key = fields.Char('ETA Hash Key', copy=False)
    l10n_eg_uuid = fields.Char(string='Document UUID', copy=False)
    l10n_eg_submission_id = fields.Char(string='Submission ID', copy=False)
    l10n_eg_signature_type = fields.Char(string='Signature Type', copy=False)
    l10n_eg_signature_data = fields.Text('Signature Data', copy=False)
    l10n_eg_posted_datetime = fields.Datetime('Posted Date', copy=False)
    l10n_eg_pdf = fields.Binary(string='ETA PDF Document', copy=False)
                
    def button_draft(self):
        self.filtered(lambda x: x.company_id.country_id.code == "EG").write({'l10n_eg_signature_data':False, 'l10n_eg_signature_type':False})
        return super().button_draft()

    def _post(self, soft=True):
        res = super()._post(soft)
        self.filtered(lambda r: r.country_code == 'EG' and r.move_type in ('out_invoice', 'out_refund') and not r.l10n_eg_posted_datetime and r.state == 'posted').write({
            'l10n_eg_posted_datetime': fields.Datetime.now()
        })
        return res

    def action_post_sign_invoice(self):
        sign_host = self.env['ir.config_parameter'].sudo().get_param('default.sign.host')

        if not sign_host:
            raise ValidationError(_('Please define the host of sign toll.'))

        url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        max_ts = int(time.time() + 120)  # valid for two minute
        msg = '%s%s%s' % (url, self.ids, max_ts)

        secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        assert secret, "CSRF protection requires a configured database secret"
        hm = hmac.new(secret.encode('ascii'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

        return {
            'type': 'ir.actions.client',
            'tag': 'action_post_sign_invoice',
            'params': {
                'invoice_ids': self.ids,
                'sign_host': sign_host,
                'token': '%so%s' % (hm, max_ts),
                'url': url
            }
        }

    def _compute_invoice_discount(self):
        #To override, if you need to put universal discount on invoice
        return 0

    def action_get_eta_invoice_pdf(self, uuid=False):
        self.ensure_one()
        if not uuid:
            uuid = self.l10n_eg_uuid
        invoice = self.env['account.edi.format']._l10n_eg_get_eta_invoice_pdf(uuid,self)
        if isinstance(invoice, dict) and invoice.get('error', False):
            _logger.warning('PDF Content Error:  %s.' % invoice.get('error'))
        else:
            pdf = base64.b64encode(invoice)
            attachments = [('ETA invoice of %s.pdf' %self.name, invoice)]
            self.message_post(body=_('ETA invoice has been recieved'), attachments=attachments)
            self.l10n_eg_pdf = pdf

    def _get_amount_main_currency(self, amount):
        from_currency = self.currency_id
        to_currency = self.company_id.currency_id
        new_amount = amount
        if from_currency != to_currency:
            new_amount = from_currency._convert(
                from_amount=amount,
                to_currency=to_currency,
                company=self.company_id,
                date=self.invoice_date,
                round=False)
        return round(new_amount,5)

    def _exchange_currency_rate(self):
        from_currency = self.currency_id
        to_currency = self.company_id.currency_id
        company = self.company_id
        rate = 1.0
        if from_currency != to_currency:
            rate = self.env['res.currency']._get_conversion_rate(from_currency, to_currency, company,
                                                                 self.invoice_date)
        return round(rate,5)
