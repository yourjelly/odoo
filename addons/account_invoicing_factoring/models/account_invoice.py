# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    factoring_ref_uuid = fields.Char('Financing Ref', readonly=True)
    factoring_status = fields.Char(string='Financing Status', default='unknown')

    @api.multi
    def action_view_factoring(self):
        self.ensure_one()
        fo_ids = self.env['invoice.financing.offer'].search([('invoice_ids', 'in', [self.id])])
        if fo_ids:
            return {
                'name': _('Factoring'),
                'view_type': 'form',
                'view_mode': 'form',
                'res_model': 'invoice.financing.offer',
                'type': 'ir.actions.act_window',
                'target': 'current',
                'res_id': fo_ids[0].id,
            }
        else:
            raise UserError(_('No Factoring found for invoice'))

    def _validate_for_factoring(self):

        if self.company_id.finexkap_account_status != 'Accepted':
            return _('Your Finaxkap account is not activated yet.')

        # Check for debtor's financing status must be accepted
        if self.partner_id.finexkap_status != 'Accepted':
            return _('Customer financing status not accepted')

        # Check for already in progress invoice
        fo_ids = self.env['invoice.financing.offer'].search([('invoice_ids', 'in', [self.id])])
        if fo_ids:
            return _('Invoice already submitted for Financing')

        if self.state != 'open' or self.partner_id.company_type != 'company':
            return _('Only company invoices can be financed')

        # FixME: Limit should be from service module
        if self.amount_total < 1000:
            return _('Amount must be greater than 1000')

        # FixMe: Allowed currency from service module
        if self.currency_id.id != self.env.ref('base.EUR').id:
            return _('You can only finance for Euro currency')

        # FixMe: Check for due date.
        date_due = datetime.strptime(self.date_due, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if date_due < today:
            return _('You can only finance with future due date')
        return None

    @api.multi
    def action_request_financing(self):
        self.ensure_one()
        # Invoice must be open and partner must as company
        errorMessage = self._validate_for_factoring()
        if errorMessage:
            raise UserError(errorMessage)

        view = self.env.ref('account_invoicing_factoring.account_invoice_factoring_view')
        return {
            'name': _('Request Financing'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.invoice.financing',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'context': {
                'active_ids': [self.id]
            }
        }
