# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ReplenishmentReport(models.AbstractModel):
    _inherit = 'report.stock.report_product_product_replenishment'

    @api.model
    def _get_report_data(self, product_template_ids=False, product_variant_ids=False):
        res = super()._get_report_data(product_template_ids, product_variant_ids)
        domain = [('state', '=', 'draft')]
        domain += self._product_purchase_domain(product_template_ids, product_variant_ids)
        qty_in = 0
        po_lines = self.env['purchase.order.line'].read_group(domain, ['product_uom_qty'], 'product_id')
        if po_lines:
            qty_in = sum(line['product_uom_qty'] for line in po_lines)

        res['draft_purchase_qty'] = qty_in
        res['qty']['in'] += qty_in
        return res

    # @api.model
    # def _get_report_line_values(self, product_template_ids, product_variant_ids):
    #     # Override to add draft Purchase Orders as a replenishing source.
    #     consuming_lines, replenish_lines = super()._get_report_line_values(product_template_ids, product_variant_ids)
    #     domain = [('state', '=', 'draft')]
    #     domain += self._product_purchase_domain(product_template_ids, product_variant_ids)
    #     pending_po_line = self.env['purchase.order.line'].search(domain)
    #     for line in pending_po_line:
    #         line_vals = {
    #             'document_in': line.order_id,
    #             'document_out': False,
    #             'move_in': False,
    #             'move_out': False,
    #             'product': {
    #                 'id': line.product_id.id,
    #                 'display_name': line.product_id.display_name
    #             },
    #             'quantity': line.product_uom_qty,
    #             'replenishment_filled': True,
    #             'uom_id': line.product_id.uom_id,
    #             'receipt_date': line.date_planned or '',
    #             'delivery_date': '',
    #             'is_late': False,
    #         }
    #         replenish_lines.append(line_vals)
    #     return consuming_lines, replenish_lines

    @api.model
    def _product_purchase_domain(self, product_template_ids, product_variant_ids):
        domain = []
        if product_variant_ids:
            domain += [('product_id', 'in', product_variant_ids)]
        elif product_template_ids:
            products = self.env['product.product'].search_read(
                [('product_tmpl_id', 'in', product_template_ids)], ['id']
            )
            product_ids = [product['id'] for product in products]
            domain += [('product_id', 'in', product_ids)]
        return domain
