# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from re import A
from odoo import api, fields, models, _
from odoo.exceptions import RedirectWarning, UserError


class AccountInvoiceSend(models.TransientModel):
    _inherit = 'account.invoice.send'

    # not_validated_account_move_id = fields.Many2one('account_move', "Account move not validated by an edi")
    all_valid = fields.Boolean("All mail have valide edi", default=True)
    invalid_invoices_ids = fields.Many2many('account.move', 'account_move_edi_account_invoice_send_rel', string='Invalid Invoices')

    @api.model
    def default_get(self, fields):
        res = super(AccountInvoiceSend, self).default_get(fields)
        invoice_ids = self.env['account.move'].browse(res['invoice_ids'])
        invoice_edi_not_valid = invoice_ids.filtered(lambda i: i.edi_state in ('to_send', 'to_cancel'))
        if len(invoice_edi_not_valid) > 0:
            res['all_valid'] = False
            res['invalid_invoices_ids'] = invoice_edi_not_valid.ids
        return res

    def action_invalid_edi_moves(self):
        return {
            'type': 'ir.actions.act_window',
            'name': _('Unprocess invoice by edi service.'),
            'res_model': 'account.move',
            'views': [(
                self.env.ref('account_edi.view_out_invoice_tree_inherit').id,
                'list',
            ), (False, 'form')],
            'domain': [('id', 'in', self.invalid_invoices_ids.ids)],
            'context': {
                'create': False,
                'delete': False,
                'expand': True,
            }
        }
