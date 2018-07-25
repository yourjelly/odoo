# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Invoice(models.Model):
    _inherit = 'account.invoice'

    @api.multi
    def action_cancel_draft(self):
        self.env['membership.membership_line'].search([
            ('account_invoice_line', 'in', self.mapped('invoice_line_ids').ids)
        ]).write({'date_cancel': False})
        return super(Invoice, self).action_cancel_draft()

    @api.multi
    def action_cancel(self):
        '''Create a 'date_cancel' on the membership_line object'''
        self.env['membership.membership_line'].search([
            ('account_invoice_line', 'in', self.mapped('invoice_line_ids').ids)
        ]).write({'date_cancel': fields.Date.today()})
        return super(Invoice, self).action_cancel()


class AccountInvoiceLine(models.Model):
    _inherit = 'account.invoice.line'

    @api.postupdate('invoice_id', 'product_id')
    def _postupdate_invoice_type(self, vals):
        MemberLine = self.env['membership.membership_line']
        for line in self.filtered(lambda line: line.invoice_id.type == 'out_invoice'):
            member_lines = MemberLine.search([('account_invoice_line', '=', line.id)])
            if line.product_id.membership and not member_lines:
                # Product line has changed to a membership product
                date_from = line.product_id.membership_date_from
                date_to = line.product_id.membership_date_to
                if line.invoice_id.date_invoice > (date_from or '0000-00-00') and line.invoice_id.date_invoice < (date_to or '0000-00-00'):
                    date_from = line.invoice_id.date_invoice
                MemberLine.create({
                    'partner': line.invoice_id.partner_id.id,
                    'membership_id': line.product_id.id,
                    'member_price': line.price_unit,
                    'date': fields.Date.today(),
                    'date_from': date_from,
                    'date_to': date_to,
                    'account_invoice_line': line.id,
                })
            if line.product_id and not line.product_id.membership and member_lines:
                # Product line has changed to a non membership product
                member_lines.unlink()
