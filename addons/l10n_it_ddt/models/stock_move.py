# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockMove(models.Model):
    _inherit = "stock.move"

    l10n_it_ddt_id = fields.Many2one(related='picking_id.l10n_it_ddt_id')
