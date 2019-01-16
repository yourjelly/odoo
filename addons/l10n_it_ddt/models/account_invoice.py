# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountInvoiceLine(models.Model):
    _inherit = 'account.invoice.line'

    def _compute_ddt_ids(self):
        for invoice_line in self:
            picking_ids = self.mapped('sale_line_ids.order_id.picking_ids')
            invoice_line.ddt_ids = picking_ids.mapped('l10n_it_ddt_id').ids

    ddt_ids = fields.Many2many(
        'l10n.it.ddt', string="DDT", compute="_compute_ddt_ids")
