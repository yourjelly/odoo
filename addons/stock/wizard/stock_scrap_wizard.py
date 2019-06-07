# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_compare


class StockScrapWizard(models.TransientModel):
    _name = 'stock.scrap.wizard'
    _description = 'scrap wizard'

    product_id = fields.Many2one(
        'product.product', 'Product', domain=[('type', 'in', ['product', 'consu'])],
        required=True)
    product_uom_id = fields.Many2one(
        'uom.uom', 'Unit of Measure',
        required=True, domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    tracking = fields.Selection('Product Tracking', readonly=True, related="product_id.tracking")
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot',
        domain="[('product_id', '=', product_id)]")
    package_id = fields.Many2one(
        'stock.quant.package', 'Package')
    owner_id = fields.Many2one('res.partner', 'Owner')
    scrap_id = fields.Many2one('stock.scrap', 'Scrap')
    picking_id = fields.Many2one('stock.picking', 'Picking')
    company_id = fields.Many2one('res.company', string='Company')
    location_id = fields.Many2one(
        'stock.location', 'Location', domain="[('usage', '=', 'internal')]",
        required=True)
    scrap_location_id = fields.Many2one(
        'stock.location', 'Scrap Location',
        domain="[('scrap_location', '=', True),]", required=True)
    scrap_qty = fields.Float('Quantity', default=1.0, required=True)
    quant_ids = fields.Many2many('stock.quant', compute='_compute_quant_ids')

    @api.depends('product_id')
    def _compute_quant_ids(self):
        for scrap in self:
            scrap.quant_ids = self.env['stock.quant'].search([
                ('product_id', '=', scrap.product_id.id),
                ('location_id.usage', '=', 'internal')
            ])

    @api.onchange('picking_id')
    def _onchange_picking_id(self):
        if self.picking_id:
            self.location_id = (self.picking_id.state == 'done') and self.picking_id.location_dest_id.id or self.picking_id.location_id.id

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.scrap_location_id = self.env['stock.location'].search([('scrap_location', '=', True), ('company_id', '=', self.company_id.id)], limit=1).id

    @api.onchange('product_id')
    def onchange_product_id(self):
        if self.product_id:
            self.product_uom_id = self.product_id.uom_id
            # Check if we can get a more precise location instead of
            # the default location (a location corresponding to where the
            # reserved product is stored)
            if self.picking_id:
                for move_line in self.picking_id.move_line_ids:
                    if move_line.product_id == self.product_id:
                        self.location_id = move_line.location_id
                        break

    def _prepare_scrap_values(self):
        self.ensure_one()
        return {
            'scrap_qty': self.scrap_qty,
            'product_uom_id': self.product_uom_id.id,
            'lot_id': self.lot_id.id,
            'picking_id': self.picking_id.id,
            'location_id': self.location_id.id,
            'scrap_location_id': self.scrap_location_id.id,
            'product_id': self.product_id.id,
            'package_id': self.package_id.id,
            'owner_id': self.owner_id.id,
        }

    def button_scrap(self):
        scrap = self.scrap_id
        if not scrap:
            vals = self._prepare_scrap_values()
            scrap = self.env['stock.scrap'].create(vals)
        return scrap.do_scrap()

    def action_validate(self):
        """This method will fetch the values about scrap quantity so that if the quantity
        is sufficient this will create scrap or it will show the availablity by location
        for product"""
        self.ensure_one()
        if self.product_id.type != 'product':
            return self.button_scrap()
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        available_qty = sum(self.env['stock.quant']._gather(self.product_id,
                                                            self.location_id,
                                                            self.lot_id,
                                                            self.package_id,
                                                            self.owner_id,
                                                            strict=True).mapped('quantity'))
        scrap_qty = self.product_uom_id._compute_quantity(self.scrap_qty, self.product_id.uom_id)
        if float_compare(available_qty, scrap_qty, precision_digits=precision) >= 0:
            return self.button_scrap()
        else:
            return {
                'name': _('Insufficient Quantity'),
                'view_type': 'form',
                'view_mode': 'form',
                'res_model': 'stock.scrap.wizard',
                'view_id': self.env.ref('stock.stock_warn_insufficient_qty_form_view').id,
                'type': 'ir.actions.act_window',
                'res_id': self.id,
                'target': 'new'
            }

    def action_done(self):
        return self.button_scrap()
