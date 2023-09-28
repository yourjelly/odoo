# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, tools, models
from odoo.exceptions import ValidationError


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    def _l10n_ke_oscu_save_stock_io_content(self):

        def check_required_fields(item):
            """ Ensure the required fields have content """
            required_fields = {
                'itemSeq', 'itemClsCd', 'itemNm', 'pkg', 'pkgUnitCd', 'qty', 'prc', 'splyAmt',
                'totDcAmt', 'taxblAmt', 'taxTyCd', 'taxAmt', 'totAmt',
            }
            for field in required_fields:
                if not isinstance(item[field], int) and not item[field]:
                    raise ValidationError(
                        _("Required field %s missing from stock move line content.", field)
                    )

        items = []
        for index, line in enumerate(self):
            product = line.product_id # for ease of use
            taxes = product.taxes_id.filtered(lambda tax: tax.l10n_ke_tax_type)
            tax_rate = taxes[0].amount if taxes else 0
            base_amount = line.quantity * product.list_price

            item = {
                'itemSeq':   index + 1,
                'itemCd':    product.l10n_ke_item_code,                    # Item code (if it's there)
                'itemClsCd': product.unspsc_code_id.code,                  # HS Code
                'itemNm':    product.name,                                 # Product name
                'bcd':       product.barcode if product.barcode else None, # Barcode
                'pkgUnitCd': product.l10n_ke_packaging_unit_id.code,       # Packaging unit code
                'pkg':       product.l10n_ke_packaging_quantity,           # Packaging quantity
                'qtyUnitCd': product.l10n_ke_quantity_unit_id.code,        # UoM (but as defined by Kenya)
                'qty':       line.quantity,                                # Quantity
                'prc':       product.list_price,                           # Unit price cost
                'splyAmt':   base_amount,                                  # Cost of items
                'totDcAmt':  0,                                            # Total discount amount
                'taxblAmt':  base_amount,                                  # Taxable amount
                'taxTyCd':   product.l10n_ke_tax_type_code,                # Tax type code
                'taxAmt':    base_amount * tax_rate,                       # Tax amount
                'totAmt':    base_amount + (base_amount * tax_rate),       # Total amount
            }
            check_required_fields(item)
            items.append(item)
        return items
