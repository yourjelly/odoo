# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import UserError

from odoo import api, fields, models, _, Command

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"

class MrpBom(models.Model):
    """ Defines bills of material for a product or a product template """
    _inherit = 'mrp.bom'

    def action_l10n_ke_send_bom(self):
        self.ensure_one()
        # Search for all variants for which this BoM is valid
        variants = self.product_id or self.product_tmpl_id.product_variant_ids
        for product in variants:
            product_code = product.l10n_ke_item_code
            if not product_code:
                raise UserError('Product %s has no code', product.name) #TODO: we should try to register products automatically
            session = self.company_id.l10n_ke_oscu_get_session()
            for bom_line in self.bom_line_ids:
                if not bom_line.product_id.l10n_ke_item_code:
                    raise UserError('Product %s has no code' % bom_line.product_id.name)
                content = {
                    "itemCd": product_code,
                    "cpstItemCd": bom_line.product_id.l10n_ke_item_code,
                    "cpstQty": bom_line.product_qty,
                    "regrId": "Test",
                    "regrNm": "Test",
                }
                response = session.post(URL + 'saveItemComposition', json=content)
                print(content, "response:", response.content)

