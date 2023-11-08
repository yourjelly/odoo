# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from odoo import api, models
from dateutil.relativedelta import relativedelta

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    @api.model
    def get_stock_data(self, args):
        location_id = args[0]['location_id']
        product_id = args[0]['product_id']
        start_date = args[0]['start_date']
        end_date = args[0]['end_date']
        posted = False

        # product_id = self.env['product.template'].search([('name', 'ilike' ,product_id)]).id
        # location_id = self.env['stock.location'].search([('complete_name', '=', location_id)]).id

        # Helper to create domain based on parameters
        def create_domain(loc_field, extra_domain=None):
            domain = [
                (loc_field, '=', location_id),
                ('product_id', '=', product_id),
                ('date', '>=', start_date),
                ('date', '<=', end_date),
                ('state', '=', 'done' if posted else 'draft')
            ]
            if extra_domain:
                domain.extend(extra_domain)
            return domain

        # Get opening stock
        opening_domain = create_domain('location_id', [('date', '<', start_date)])
        opening_moves = self.search(opening_domain)
        opening_stock = sum(opening_moves.mapped('qty_done'))

        # Get incoming quantities
        in_domain = create_domain('location_dest_id')
        in_moves = self.search(in_domain)
        in_qty = sum(in_moves.mapped('qty_done'))

        # Get outgoing quantities
        out_domain = create_domain('location_id')
        out_moves = self.search(out_domain)
        out_qty = sum(out_moves.mapped('qty_done'))

        # Calculate closing stock
        closing_stock = opening_stock + in_qty - out_qty

        # Return a dictionary with all the data
        return [{
            'opening_stock': opening_stock,
            'in_qty': in_qty,
            'out_qty': out_qty,
            'closing_stock': closing_stock
        }]
       
    @api.model
    def spreadsheet_stock_line_action(self, args):
        domain = [
            ('location_id', '=', args[0]['location_id']),
            ('product_id', '=', args[0]['product_id']),
            ('date', '>=', args[0]['start_date']),
            ('date', '<=', args[0]['end_date']),
            ('state', '=', 'done')
        ]

        return {
            "type": "ir.actions.act_window",
            "res_model": "stock.move.line",
            "view_mode": "list",
            "views": [[False, "list"]],
            "target": "current",
            "domain": domain,
            "name": "Stock Moves",
        }
