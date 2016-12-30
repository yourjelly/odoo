# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools.sql import drop_view_if_exists


class ReportStockExactLocation(models.Model):
    _name = "report.stock.exact.location"
    _description = "Report with exact stock locations compared to Stock Moves"
    _auto = False
    _order = "date"

    location_id = fields.Many2one('stock.location', 'Location', readonly=True, index=True)
    location_dest_id = fields.Many2one('stock.location', 'Location', readonly=True, index=True)
    product_id = fields.Many2one('product.product', 'Product', readonly=True, index=True)
    package_id = fields.Many2one('stock.quant.package', 'Package', readonly=True, index=True)
    date = fields.Datetime('Date', readonly=True)
    state= fields.Char('state')

    @api.model_cr
    def init(self):
        drop_view_if_exists(self._cr, 'report_stock_exact_location')
        self._cr.execute("""
        create or replace view report_stock_exact_location as 
            (SELECT id, location_id, location_dest_id, product_id, null as package_id, product_uom_qty, product_uom, date, state 
                FROM stock_move WHERE picking_id IS NULL 
            UNION SELECT (-o.id) as id, o.location_id, o.location_dest_id, o.product_id, o.package_id, o.product_qty, o.product_uom_id, o.date, p.state
            FROM stock_pack_operation o, stock_picking p WHERE p.id = o.picking_id)
            """)
