# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools import float_compare


class StockWarnInsufficientQty(models.AbstractModel):
    _name = 'stock.warn.insufficient.qty'

    def _get_default_location_id(self):
        return self.env.ref('stock.stock_location_stock', raise_if_not_found=False)

    product_id = fields.Many2one('product.product', 'Product', required=True)
    product_uom_id = fields.Many2one('product.uom', 'Unit of Measure', required=True)
    location_id = fields.Many2one(
        'stock.location', 'Location', domain="[('usage', '=', 'internal')]", required=True, default=_get_default_location_id)
    product_qty = fields.Float('Quantity', default=1.0, required=True)
    lot_id = fields.Many2one('stock.production.lot', 'Lot', domain="[('product_id', '=', product_id)]")
    quants = fields.Many2many('stock.quant', compute='_compute_quants', store=True)

    @api.one
    @api.depends('product_id')
    def _compute_quants(self):
        quants = self.env['stock.quant'].search([('product_id', '=', self.product_id.id), ('location_id.usage', '=', 'internal')])
        self.quants = [(6, 0, [q.id for q in quants])]

    @api.onchange('product_id')
    def onchange_product_id(self):
        if self.product_id:
            self.product_uom_id = self.product_id.uom_id.id

    def action_done(self):
        raise NotImplementedError()


class StockScrapWizard(models.TransientModel):
    _name = 'stock.scrap.wizard'
    _inherit = 'stock.warn.insufficient.qty'
    _description = 'Scrap'

    def _get_default_scrap_location_id(self):
        return self.env['stock.location'].search([('scrap_location', '=', True)], limit=1).id

    package_id = fields.Many2one('stock.quant.package', 'Package')
    owner_id = fields.Many2one('res.partner', 'Owner')
    scrap_location_id = fields.Many2one('stock.location', 'Scrap Location', default=_get_default_scrap_location_id, domain="[('scrap_location', '=', True)]", required=True)
    tracking = fields.Selection('Product Tracking', related="product_id.tracking")
    origin = fields.Char(string='Source Document')
    picking_id = fields.Many2one('stock.picking', 'Picking')

    @api.onchange('picking_id')
    def onchange_picking_id(self):
        if self.picking_id:
            self.location_id = (self.picking_id.state == 'done') and self.picking_id.location_dest_id.id or self.picking_id.location_id.id

    def _prepare_scrap_vals(self):
        return {
            'product_id': self.product_id,
            'scrap_qty': self.product_qty,
            'origin': self.origin,
            'product_id': self.product_id.id,
            'product_uom_id': self.product_uom_id.id,
            'location_id': self.location_id.id,
            'scrap_location_id': self.scrap_location_id.id,
            'lot_id': self.lot_id.id,
            'picking_id': self.picking_id.id,
            'package_id': self.package_id.id,
            }

    def do_scrap(self):
        scrap = self.env['stock.scrap'].create(self._prepare_scrap_vals())
        return scrap.do_scrap()

    def get_action(self):
        """Will return the action to open warning wizard"""
        action = self.env.ref('stock.action_stock_scrap_warning_wizard').read()[0]
        action['res_id'] = self.id
        action['context'] = {
            'default_product_id': self.product_id.id,
            'default_product_uom_id': self.product_uom_id.id,
            'default_location_id': self.location_id.id,
        }
        return action

    def action_done(self):
        self.ensure_one()
        self.do_scrap()
        return True

    def action_validate(self):
        """Checks and do scrap if given qty is available in stock else will call get_action """
        self.ensure_one()
        lot_id = self.lot_id or None
        package_id = self.package_id or None
        owner_id = self.owner_id or None
        available_qty = self.env['stock.quant']._get_available_quantity(self.product_id, self.location_id, lot_id, package_id, owner_id, strict=True)
        if float_compare(available_qty, self.product_qty, 2) >= 0:
            self.do_scrap()
        else:
            return self.get_action()
        return True


class StockWarnInsufficientQtyScrap(models.TransientModel):
    _name = 'stock.warn.insufficient.qty.scrap'
    _inherit = 'stock.warn.insufficient.qty'

    scrap_id = fields.Many2one('stock.scrap', 'Scrap')

    def action_done(self):
        return self.scrap_id.do_scrap()
