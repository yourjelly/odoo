# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tests import Form


class AccountMove(models.Model):
    _inherit = 'account.move'

    is_retention = fields.Boolean(help="Technical field to determine this is a retention. ")
    wht_invoice_id = fields.Many2one('account.move', string="Withheld invoice", help="Withheld invoice")
    wht_invoice_line_ids = fields.One2many(string="Withholding Lines", related="wht_invoice_id.invoice_line_ids")
    wht_ids = fields.One2many('account.move', 'wht_invoice_id')

    def _post(self, soft=True):
        res = super()._post(soft=soft)
        for move in self:
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

        return res


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    # TODO: add onchange for tax_base_amount, which will calculate the subtotal, ...

