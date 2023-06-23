# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class StockMove(models.Model):
    _inherit = "stock.move"

    @api.depends('product_id', 'product_uom', 'quantity')
    def _compute_ewaybill_price_unit(self):
        for line in self:
            if line.purchase_line_id:
                line.ewaybill_price_unit = line.purchase_line_id.price_unit
            else:
                super()._compute_ewaybill_price_unit()
