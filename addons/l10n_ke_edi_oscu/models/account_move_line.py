# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
#
import logging
import json
import re
from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

from ..utils import check_required_fields

_logger = logging.getLogger(__name__)

class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def _l10n_ke_oscu_get_items(self, tax_details):
        # def get_tax_code(line, tax_details):
        #     """ Traverse the tax details for the line and use the tax code of the first tax that has one """
        #     for tax in tax_details['tax_details_per_record'][line]['tax_details'].keys():
        #         if tax['tax'].l10n_ke_tax_type_id:
        #             return tax['tax'].l10n_ke_tax_type_id.code

        line_dict = {}
        per_record = tax_details['tax_details_per_record']
        for index, line in enumerate(self):
            product = line.product_id # for eas of reference
            line_dict[line.id] = {
                'itemSeq': index+1,                                        # Line number
                'itemCd': product.l10n_ke_item_code,                       # Item code as defined by us, of the form KE2BFTNE0000000000000039
                'itemClsCd': product.unspsc_code_id.code,                  # Item classification code, in this case the UNSPSC code
                'itemNm': line.name,                                       # Item name
                'pkgUnitCd': product.l10n_ke_packaging_unit_id.code,       # Packaging code, describes the type of package used
                'pkg': product.l10n_ke_packaging_quantity * line.quantity, # Number of packages used
                'qtyUnitCd': product.l10n_ke_quantity_unit_id.code,        # The UOMs as defined by the KRA, defined seperately from the UOMs on the line
                'qty': line.quantity,
                'prc': line.price_unit,
                'splyAmt': line.quantity * line.price_unit,
                'dcRt': line.discount,
                'dcAmt': line.quantity * line.price_unit * (line.discount/100), # TODO, this and above, the more complex implementation details,
                'taxTyCd': line.tax_ids.l10n_ke_tax_type.code,
                'taxblAmt': per_record[line]['base_amount'],
                'taxAmt': per_record[line]['tax_amount'],
                'totAmt': per_record[line]['base_amount'] + per_record[line]['tax_amount'],
            }
            if line.product_id.barcode:
                line_dict[line.id].update({'bcd': product.barcode})
            missing_fields = check_required_fields('TrnsSalesSaveWrItem', line_dict[line.id])
            if missing_fields:
                raise ValidationError(_("Required field %s missing from invoice content.", missing_fields))
        return line_dict
