# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    @api.multi
    def action_view_factoring(self):
        self.ensure_one()
        # TODO: Redirect to invoice factoring lists

    def _valid_for_factoring(self):
        errorMessage = None
        if self.state != 'open' or self.partner_id.company_type != 'company':
            errorMessage = _('Only company invoices can be financed')

        # FixME: Limit should be from service module
        if self.amount_total < 1000:
            errorMessage = _('Amount must be greater than 1000')

        # FixMe: Allowed currency from service module
        if self.currency_id.id != self.env.ref('base.EUR').id:
            errorMessage = _('You can only finance for Euro currency')

        # TODO: Check for due date.

        return errorMessage

    @api.multi
    def action_request_financing(self):
        self.ensure_one()
        # Invoice must be open and partner must as company
        errorMessage = self._valid_for_factoring()
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
