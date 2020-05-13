# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ReplenishmentReport(models.AbstractModel):
    _inherit = 'report.stock.report_product_product_replenishment'

    @api.model
    def _get_report_data(self, product_template_ids=False, product_variant_ids=False):
        res = super()._get_report_data(product_template_ids, product_variant_ids)
        domain = [('state', '=', 'draft')]
        domain += self._product_sale_domain(product_template_ids, product_variant_ids)
        qty_out = 0
        # so_lines = self.env['sale.order.line'].read_group(domain, ['product_uom_qty'], 'product_id')
        # if so_lines:
        #     # line.product_qty = line.product_uom._compute_quantity(line.product_uom_qty, line.product_id.uom_id)
        #     qty_out = sum(line['product_uom_qty'] for line in so_lines)
        so_lines = self.env['sale.order.line'].search(domain)
        if so_lines:
            product_uom = so_lines[0].product_id.uom_id
            quantities = so_lines.mapped(lambda line: line.product_uom._compute_quantity(line.product_uom_qty, product_uom))
            qty_out = sum(quantities)
        res['draft_sale_qty'] = qty_out
        res['qty']['out'] += qty_out
        return res

    # @api.model
    # def _get_report_line_values(self, product_template_ids, product_variant_ids):
    #     # Override to add draft Sale Orders as a consuming source.
    #     consuming_lines, replenish_lines = super()._get_report_line_values(product_template_ids, product_variant_ids)
    #     domain = [('state', '=', 'draft')]
    #     domain += self._product_sale_domain(product_template_ids, product_variant_ids)
    #     pending_so_line = self.env['sale.order.line'].search(domain)
    #     today = fields.Date.today()
    #     for line in pending_so_line:
    #         line_vals = {
    #             'document_in': False,
    #             'document_out': line.order_id,
    #             'move_in': False,
    #             'move_out': False,
    #             'product': {
    #                 'id': line.product_id.id,
    #                 'display_name': line.product_id.display_name
    #             },
    #             'quantity': line.product_uom_qty,
    #             'replenishment_filled': False,
    #             'uom_id': line.product_uom,
    #             'receipt_date': '',
    #             'delivery_date': line.order_id.validity_date or '',
    #             'is_late': line.order_id.validity_date and line.order_id.validity_date < today,
    #         }
    #         consuming_lines.append(line_vals)
    #     return consuming_lines, replenish_lines

    @api.model
    def _product_sale_domain(self, product_template_ids, product_variant_ids):
        domain = []
        if product_template_ids:
            domain += [('product_template_id', 'in', product_template_ids)]
        elif product_variant_ids:
            domain += [('product_id', 'in', product_variant_ids)]
        return domain
