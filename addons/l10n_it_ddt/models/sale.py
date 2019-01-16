# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def _compute_ddt_ids(self):
        for order in self:
            order.ddt_ids = picking_ids.mapped('ddt_id').ids

    ddt_ids = fields.Many2many(
        'l10n.it.ddt', string="DDT", compute="_compute_ddt_ids")
