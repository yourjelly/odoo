# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class StockScrapWizard(models.TransientModel):
    _inherit = 'stock.scrap.wizard'

    production_id = fields.Many2one(
        'mrp.production', 'Manufacturing Order')
    workorder_id = fields.Many2one(
        'mrp.workorder', 'Work Order',
        help='Not to restrict or prefer quants, but informative.')

    @api.onchange('workorder_id')
    def _onchange_workorder_id(self):
        if self.workorder_id:
            self.location_id = self.workorder_id.production_id.location_src_id.id

    @api.onchange('production_id')
    def _onchange_production_id(self):
        if self.production_id:
            self.location_id = self.production_id.move_raw_ids.filtered(lambda x: x.state not in ('done', 'cancel')) and self.production_id.location_src_id.id or self.production_id.location_dest_id.id

    def _prepare_scrap_values(self):
        vals = super(StockScrapWizard, self)._prepare_scrap_values()
        if self.production_id:
            vals.update({'production_id': self.production_id.id, 'workorder_id': self.workorder_id.id})
        return vals
