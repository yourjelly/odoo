# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.tools import float_compare, float_is_zero


class StockMoveLine(models.Model):
    _inherit = 'stock.move.line'

    def _is_analytic_move_to_recompute(self):
        self.ensure_one()
        if not self.production_id:
            return True
        if self.production_id.state != 'done' and self.production_id.state != 'to_close':
            return False
        return super()._is_analytic_move_to_recompute()
