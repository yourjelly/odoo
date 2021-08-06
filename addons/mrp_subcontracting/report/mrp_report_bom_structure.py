# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class ReportBomStructure(models.AbstractModel):
    _inherit = 'report.mrp.report_bom_structure'

    def _get_subcontracting_line(self, bom, seller, level):
        return {
            'name': seller.name.display_name,
            'partner_id': seller.name.id,
            'quantity': bom.product_qty,
            'uom': bom.product_uom_id,
            'prod_cost': seller.price,
            'bom_cost': seller.price / bom.product_qty,
            'level': level or 0
        }

    def _get_bom(self, bom_id=False, product_id=False, line_qty=False, line_id=False, level=False):
        res = super(ReportBomStructure, self)._get_bom(bom_id, product_id, line_qty, line_id, level)
        bom = res['bom']
        if bom and bom.type == 'subcontract':
            seller = res['product']._select_seller(params={'subcontractor_ids': bom.subcontractor_ids})
            if seller:
                res['subcontracting'] = self._get_subcontracting_line(bom, seller, level)
                res['total'] += seller.price
        return res

    def _get_sub_lines(self, bom, product_id, line_qty, line_id, level, child_bom_ids, unfolded):
        res = super()._get_sub_lines(bom, product_id, line_qty, line_id, level, child_bom_ids, unfolded)
        if bom and bom.type == 'subcontract':
            product = self.env['product.product'].browse(product_id)
            seller = product._select_seller(params={'subcontractor_ids': bom.subcontractor_ids})
            if seller:
                values_sub = self._get_subcontracting_line(bom, seller, level)
                values_sub['type'] = 'bom'
                values_sub['name'] = _("Subcontracting: ") + values_sub['name']
                res.append(values_sub)

        return res
