# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tests import Form


class AccountMove(models.Model):
    _inherit = 'account.move'

    is_retention = fields.Boolean(help="Technical field to determine this is a retention move. ")
    wht_invoice_id = fields.Many2one('account.move', string="Withheld invoice", help="Withheld invoice")
    wht_invoice_line_ids = fields.One2many(string="Withholding Lines", related="wht_invoice_id.invoice_line_ids")
    wht_ids = fields.One2many('account.move', 'wht_invoice_id')
    amount_wht = fields.Monetary("Withheld Amount", compute="_compute_amount_wht")

    def _compute_amount_wht(self):
        # TODO: replace by read_group
        for move in self:
            amount_wht = 0.0
            for ret in move.wht_ids:
                amount_wht += ret.amount_total
            move.amount_wht = amount_wht

    def _post(self, soft=True):
        res = super()._post(soft=soft)
        for move in self.filtered(lambda m: m.move_type in ('in_invoice', 'out_invoice')):
            ivls = move.invoice_line_ids.filtered(lambda ml: any(t.is_retention for t in ml.tax_ids))
            if ivls:
                with Form(self.env['account.move'].with_context(calc_retention=True, default_move_type=move.move_type)) as invoice_form:
                    for ivl in ivls:
                        with invoice_form.invoice_line_ids.new() as invline:
                            invline.product_id = ivl.product_id
                            invline.price_unit = ivl.price_unit
                            invline.quantity = ivl.quantity
                            invline.tax_ids.clear()
                            for t in ivl.tax_ids:
                                print(t.is_retention)
                                invline.tax_ids.add(t)
                new_invoice = invoice_form.save()

                with Form(self.env['account.move'].with_context(default_move_type="entry")) as retention_form:
                    retention_form.partner_id = move.partner_id
                retention_move = retention_form.save()
                retention_move.is_retention = True
                retention_move.wht_invoice_id = move.id
                retention_tax_lines = new_invoice.line_ids.filtered(lambda l:l.tax_line_id.is_retention)
                total_credit = 0.0
                for ret in retention_tax_lines:
                    total_credit += ret.credit
                result = [(0, 0, {'debit': total_credit,
                                  'account_id': move.line_ids[0].account_id.id})] + [(4, x) for x in retention_tax_lines.ids]
                retention_move.line_ids = result
                new_invoice.unlink()
        for move in self.filtered(lambda m: m.is_retention and m.wht_invoice_id):
            inv_wht = move.wht_invoice_id
            result = (move.line_ids[-1] | inv_wht.line_ids[0]).reconcile()
            print(result)
        return res

    def open_wht_view(self):
        return {
            'name': _('Retention Items'),
            'view_mode': 'tree,form',
            'res_model': 'account.move',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.wht_ids.ids)],
        }

    def button_create_retention(self):
        self.ensure_one()
        with Form(self.env['account.move'].with_context(default_move_type="entry")) as retention_form:
            retention_form.partner_id = self.partner_id
            retention_form.wht_invoice_id = self.id
        retention_form.save()
        return True #TODO: should return an action to a new manual retention


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    # TODO: add onchange for tax_base_amount, which will calculate the subtotal, ...

