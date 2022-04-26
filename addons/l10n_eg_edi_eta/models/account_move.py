# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json
from datetime import datetime

from odoo import api, models, fields, _
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_eg_submission_id = fields.Char(string='Submission ID', compute='_compute_eta_response_data', store=True, copy=False)
    l10n_eg_uuid = fields.Char(string='Document UUID', compute='_compute_eta_response_data', store=True, copy=False)
    l10n_eg_eta_json_doc_id = fields.Many2one('ir.attachment', copy=False)
    l10n_eg_signing_time = fields.Datetime('Signing Time', copy=False)
    l10n_eg_is_signed = fields.Boolean(copy=False)

    @api.depends('l10n_eg_eta_json_doc_id.raw')
    def _compute_eta_response_data(self):
        for rec in self:
            response_data = rec.l10n_eg_eta_json_doc_id and json.loads(rec.l10n_eg_eta_json_doc_id.raw).get('response')
            if response_data:
                rec.l10n_eg_uuid = response_data.get('l10n_eg_uuid')
                rec.l10n_eg_submission_id = response_data.get('l10n_eg_submission_id')
            else:
                rec.l10n_eg_uuid = False
                rec.l10n_eg_submission_id = False

    def button_draft(self):
        self.l10n_eg_eta_json_doc_id = False
        self.l10n_eg_is_signed = False
        return super().button_draft()

    def action_post_sign_invoice(self):
        # only sign invoices that are confirmed and not yet sent to the ETA.
        self = self.filtered(lambda r: r.country_code == 'EG' and r.state == 'posted' and not r.l10n_eg_submission_id)
        if not self:
            return

        company_ids = self.mapped('company_id')
        # since the middleware accepts only one drive at a time, we have to limit signing to one company at a time
        if len(company_ids) > 1:
            raise UserError(_('Please only sign invoices from one company at a time'))

        company_id = company_ids[0]
        drive_id = self.env['l10n_eg_edi.thumb.drive'].search([('user_id', '=', self.env.user.id),
                                                               ('company_id', '=', company_id.id)])

        if not drive_id:
            raise ValidationError(_('Please setup a personal drive for company %s', company_id.name))

        if not drive_id.certificate:
            raise ValidationError(_('Please setup the certificate on the thumb drive menu'))

        self.write({'l10n_eg_signing_time': datetime.utcnow()})

        for invoice in self.filtered(lambda r: r.country_code == 'EG'):
            eta_invoice = self.env['account.edi.format']._l10n_eg_eta_prepare_eta_invoice(invoice)
            attachment = self.env['ir.attachment'].create({
                    'name': _('ETA_INVOICE_DOC_%s', invoice.name),
                    'res_id': invoice.id,
                    'res_model': invoice._name,
                    'type': 'binary',
                    'raw': json.dumps(dict(request=eta_invoice)),
                    'mimetype': 'application/json',
                    'description': _('Egyptian Tax authority JSON invoice generated for %s.', invoice.name),
                })
            invoice.l10n_eg_eta_json_doc_id = attachment.id
        return drive_id.action_sign_invoice(self)

    def action_get_eta_invoice_pdf(self):
        self.ensure_one()
        eta_invoice_pdf = self.env['account.edi.format']._l10n_eg_get_eta_invoice_pdf(self)
        if eta_invoice_pdf.get('error', False):
            _logger.warning('PDF Content Error:  %s.', eta_invoice_pdf.get('error'))
            return
        self.with_context(no_new_invoice=True).message_post(body=_('ETA invoice has been received'), attachments=[('ETA invoice of %s.pdf' % self.name, eta_invoice_pdf.get('data'))])

    def _exchange_currency_rate(self):
        from_currency = self.currency_id
        to_currency = self.company_id.currency_id
        rate = 1.0
        if from_currency != to_currency and self.invoice_line_ids:
            rate = abs(self.invoice_line_ids[0].balance / self.invoice_line_ids[0].amount_currency)
        return round(rate, 5)
