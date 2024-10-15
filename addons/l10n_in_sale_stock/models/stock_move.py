# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons import sale_stock, l10n_in_stock


class StockMove(l10n_in_stock.StockMove, sale_stock.StockMove):

    def _l10n_in_get_product_price_unit(self):
        self.ensure_one()
        if line_id := self.sale_line_id:
            if qty := line_id.product_uom_qty:
                company_id = line_id.company_id
                return line_id.currency_id._convert(
                    line_id.price_subtotal / qty,
                    company_id.currency_id,
                    company_id,
                    self.date,
                    round=False
                )
            return 0.00
        return super()._l10n_in_get_product_price_unit()

    def _l10n_in_get_product_tax(self):
        self.ensure_one()
        if line_id := self.sale_line_id:
            return {
                'is_from_order': True,
                'taxes': line_id.tax_id,
            }
        return super()._l10n_in_get_product_tax()
