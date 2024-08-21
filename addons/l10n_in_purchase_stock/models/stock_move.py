# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class StockMove(models.Model):
    _inherit = "stock.move"

    def _l10n_in_get_product_price_unit(self):
        self.ensure_one()
        if line_id := self.purchase_line_id:
            purchase_line = self.purchase_line_id
            purchase_company = purchase_line.company_id
            company_currency = purchase_company.currency_id
            if qty := line_id.product_qty:
                price_unit_after_discount = (line_id.price_subtotal / qty)
                return purchase_line.currency_id._convert(price_unit_after_discount, company_currency, purchase_company, fields.Date.today(), round=False)
            return 0.00
        return super()._l10n_in_get_product_price_unit()

    def _l10n_in_get_product_tax(self):
        self.ensure_one()
        if line_id := self.purchase_line_id:
            return {
                'is_from_order': True,
                'taxes': line_id.taxes_id
            }
        return super()._l10n_in_get_product_tax()
