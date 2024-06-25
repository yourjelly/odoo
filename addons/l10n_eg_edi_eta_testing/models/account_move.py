# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import models, _
from odoo.exceptions import UserError
from datetime import datetime



class AccountMove(models.Model):
    _inherit = 'account.move'
    def action_post_sign_invoices(self):
        # only sign invoices that are confirmed and not yet sent to the ETA.
        invoices = self.filtered(lambda r: r.country_code == 'EG' and r.state == 'posted' and not r.l10n_eg_submission_number and r.edi_document_ids.filtered(lambda e: e.edi_format_id.code == 'eg_eta'))
        if not invoices:
            return

        company_ids = invoices.mapped('company_id')
        # since the middleware accepts only one drive at a time, we have to limit signing to one company at a time
        if len(company_ids) > 1:
            raise UserError(_('Please only sign invoices from one company at a time'))

        company_id = company_ids[0]
        drive_id = self.env['l10n_eg_edi.thumb.drive'].search([('user_id', '=', self.env.user.id),
                                                               ('company_id', '=', company_id.id)])

        # if not drive_id:
        #     raise ValidationError(_('Please setup a personal drive for company %s', company_id.name))

        # if not drive_id.certificate:
        #     raise ValidationError(_('Please setup the certificate on the thumb drive menu'))

        self.write({'l10n_eg_signing_time': datetime.utcnow()})

        for invoice in invoices:
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
        return drive_id.action_sign_invoices(self)
