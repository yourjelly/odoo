# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class StockWarnInsufficientQty(models.AbstractModel):
    _name = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Quantity'

    product_id = fields.Many2one('product.product', 'Product', required=True)
    location_id = fields.Many2one( 'stock.location', 'Location', domain="[('usage', '=', 'internal')]", required=True)
    quant_ids = fields.Many2many('stock.quant', compute='_compute_quant_ids')

    @api.one
    @api.depends('product_id')
    def _compute_quant_ids(self):
        self.quant_ids = self.env['stock.quant'].search([
            ('product_id', '=', self.product_id.id),
            ('location_id.usage', '=', 'internal')
        ])

    def action_done(self):
        raise NotImplementedError()


class StockWarnInsufficientQtyScrap(models.TransientModel):
    _name = 'stock.warn.insufficient.qty.scrap'
    _inherit = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Scrap Quantity'

    scrap_id = fields.Many2one('stock.scrap', 'Scrap')
    product_uom_id = fields.Many2one('uom.uom', 'Unit of Measure', domain="[('category_id', '=', product_uom_category_id)]")
    lot_id = fields.Many2one('stock.production.lot', 'Lot', domain="[('product_id', '=', product_id)]")
    package_id = fields.Many2one('stock.quant.package', 'Package')
    owner_id = fields.Many2one('res.partner', 'Owner')

    def action_done(self):
        if self.scrap_id:
            return self.scrap_id.do_scrap()
        values = {
            'product_id': self.product_id.id,
            'product_uom_id': self.product_uom_id.id,
            'location_id': self.location_id.id,
            'lot_id': self.lot_id.id,
            'package_id': self.package_id.id,
            'owner_id': self.owner_id.id,
        }
        scrap = self.env['stock.scrap'].create(values)
        return scrap.do_scrap()
