# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ReplenishmentReport(models.AbstractModel):
    _inherit = 'report.stock.report_product_product_replenishment'

    @api.model
    def _get_report_data(self, product_template_ids=False, product_variant_ids=False):
        res = super()._get_report_data(product_template_ids, product_variant_ids)
        mo_domain = [('state', '=', 'draft')]
        mo_domain += self._product_domain(product_template_ids, product_variant_ids)
        qty_in, qty_out = 0, 0
        # Pending incoming quantity.
        grouped_mo = self.env['mrp.production'].read_group(mo_domain, ['product_qty'], 'product_id')
        if grouped_mo:
            qty_in = sum(mo['product_qty'] for mo in grouped_mo)
        # Pending outgoing quantity.
        move_domain = [('raw_material_production_id', '!=', False)] + mo_domain
        grouped_moves = self.env['stock.move'].read_group(move_domain, ['product_qty'], 'product_id')
        if grouped_moves:
            qty_out = sum(move['product_qty'] for move in grouped_moves)

        res['draft_production_qty'] = {
            'in': qty_in,
            'out': qty_out,
        }
        res['qty']['in'] += qty_in
        res['qty']['out'] += qty_out
        return res

    # @api.model
    # def _get_report_line_values(self, product_template_ids, product_variant_ids):
    #     # Override to add draft Manufacturing Orders as a replenishing source.
    #     consuming_lines, replenish_lines = super()._get_report_line_values(product_template_ids, product_variant_ids)
    #     mo_domain = [('state', '=', 'draft')]
    #     mo_domain += self._product_domain(product_template_ids, product_variant_ids)
    #     pending_mo = self.env['mrp.production'].search(mo_domain)
    #     for mo in pending_mo:
    #         mo_line = {
    #             'document_in': mo,
    #             'document_out': False,
    #             'move_in': False,
    #             'move_out': False,
    #             'product': {
    #                 'id': mo.product_id.id,
    #                 'display_name': mo.product_id.display_name
    #             },
    #             'quantity': mo.product_qty,
    #             'replenishment_filled': True,
    #             'uom_id': mo.product_id.uom_id,
    #             'receipt_date': mo.date_planned_finished or '',
    #             'delivery_date': '',
    #             'is_late': False,
    #         }
    #         replenish_lines.append(mo_line)
    #     return consuming_lines, replenish_lines
