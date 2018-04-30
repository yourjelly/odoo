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

    @api.multi
    def action_request_financing(self):
        self.ensure_one()
        if self.state != 'open' or self.partner_id.company_type != 'company':
            raise UserError(_('Only company invoices can be financed'))

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
