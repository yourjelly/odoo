# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from odoo import models
from odoo.tools.misc import groupby


class ReportDeliverySlip(models.AbstractModel):
    _name = 'report.stock.report_deliveryslip'
    _description = 'Delivery Slip'

    def _compute_packaging_qtys(aggregated_move_lines):
        # Needs to be computed after aggregation of line qtys
        for line in aggregated_move_lines.values():
            if line['packaging']:
                line['packaging_qty'] = line['packaging']._compute_qty(line['qty_ordered'], line['product_uom'])
                line['packaging_qty_done'] = line['packaging']._compute_qty(line['qty_done'], line['product_uom'])
        return aggregated_move_lines

    def _get_aggregated_properties(move_line):
        move = move_line.move_id
        uom = move.product_uom
        name = move.product_id.display_name
        description = move.description_picking
        if description == name or description == move.product_id.name:
            description = False
        product = move.product_id
        line_key = f'{product.id}_{product.display_name}_{description or ""}_{uom.id}'
        return (line_key, name, description, uom)

    def _get_report_values(self, docids, data):
        aggregated_lines = {}

        docs = self.env['stock.picking'].browse(docids)
        for picking in docs:
            backorders = self.env['stock.picking']
            pickings = picking
            while pickings.backorder_ids:
                backorders |= pickings.backorder_ids
                pickings = pickings.backorder_ids

            remaining_initial_demand = {move: move.product_uom_qty for move in picking.move_ids}

            aggregated_lines[picking] = {}
            # 1. display the packages
            for package, move_lines in groupby(picking.move_line_ids, lambda ml: ml.result_package_id):
                if not package:
                    continue
                package_lines = self._get_package_quantities(, move_lines, remaining_initial_demand)
                aggregated_lines[picking][package] = package_lines

            # 2. display the bulk lines
            bulk_move_lines = picking.move_line_ids.filtered(lambda ml: not ml.result_package_id)
            for key, move_lines in groupby(bulk_move_lines, self._get_aggregated_properties):
                aggregated_lines[picking][False] = {
                    key: self._get_aggregated_product_quantities(key, move_lines, remaining_initial_demand)
                }

        return {
            'doc_ids': docids,
            'doc_model': 'stock.picking',
            'docs': self.env['stock.picking'].browse(docids),
            'picking_aggregated_lines': aggregated_lines,
        }

    def _get_package_quantities(self, move_lines, remaining_initial_demand):
        aggregated_move_lines = {}
        for key, mls in groupby(move_lines, self._get_aggregated_properties):
            aggregated_move_lines[key] = self._get_aggregated_product_quantities(key, mls, remaining_initial_demand)
        return aggregated_move_lines

    def _get_aggregated_product_quantities(self, key, move_lines, remaining_initial_demand):
        qty_ordered = 0
        move_lines = self.env['stock.move.line'].concat(*move_lines)
        for ml in move_lines:
            initial_demand = remaining_initial_demand[ml.move_id]
            intake = min(ml.qty_done, initial_demand)
            qty_ordered += intake
            remaining_initial_demand[ml.move_id] - intake
        return {
            'name': key[1],
            'description': key[2],
            'qty_done': sum(move_lines.mapped('qty_done')),
            'qty_ordered': qty_ordered,
            'product_uom': key[3],
            'product': move_lines.product_id,
        }
