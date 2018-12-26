# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    l10n_it_ddt_id = fields.Many2one('l10n.it.ddt', String="DDT")
