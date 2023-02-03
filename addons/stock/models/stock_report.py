# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from datetime import datetime
from odoo import models, fields, api, _, osv, Command


class StockReportNew(models.AbstractModel):
    _name = "stock.report.new"
    _description = "Stock Report1"

    #  CORE ==========================================================================================================================================

    def get_report_informations(self):
        lot_stock_id = self.env.ref('stock.warehouse0').lot_stock_id
        moves_data = self.env['stock.move'].search_read(['&', '&', ('date', '>', '2023-01-01'), ('picking_code', 'in', ['incoming', 'outgoing']), '|', ('location_id', '=', lot_stock_id.id), ('location_dest_id', '=', lot_stock_id.id)], fields=['product_id', 'product_qty', 'picking_code'])
        product_data = self.env['product.product'].with_context(to_date=datetime(2023,1,1)).search_read(
            [
                '|',
                ('stock_move_ids.location_id', '=', lot_stock_id.id),
                ('stock_move_ids.location_dest_id', '=', lot_stock_id.id)
            ], fields=['id', 'name', 'qty_available'])
        to_product_data = self.env['product.product'].with_context(to_date=datetime(2023,3,31)).search_read(
            [
                '|',
                ('stock_move_ids.location_id', '=', lot_stock_id.id),
                ('stock_move_ids.location_dest_id', '=', lot_stock_id.id)
            ], fields=['id', 'qty_available'])

        in_qty = {}
        out_qty = {}

        for data in product_data:
            for to_data in to_product_data:
                if to_data['id'] == data['id']:
                    data['qty_available_end'] = to_data['qty_available']
        for move in moves_data:
            if move['picking_code'] == 'incoming':
                in_qty.setdefault(move['product_id'][0], 0)
                in_qty[move['product_id'][0]] += move['product_qty']
            if move['picking_code'] == 'outgoing':
                out_qty.setdefault(move['product_id'][0], 0)
                out_qty[move['product_id'][0]] += move['product_qty']

        main_html = self.env['ir.qweb']._render("stock.stock_main_template", {'product_data': product_data, 'in_qty': in_qty, 'out_qty': out_qty})
        info = {
            'main_html': main_html,
            'searchview_html': self.env['ir.ui.view']._render_template('stock.search_template', values={}),
        }
        return info
