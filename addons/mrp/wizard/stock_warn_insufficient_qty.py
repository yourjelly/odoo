# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockWarnInsufficientQtyUnbuild(models.TransientModel):
    _name = 'stock.warn.insufficient.qty.unbuild'
    _inherit = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Unbuild Quantity'

    unbuild_id = fields.Many2one('mrp.unbuild', 'Unbuild')

    def action_done(self):
        self.ensure_one()
        return self.unbuild_id.action_unbuild()


class MrpWarnInsufficientQtyScrap(models.TransientModel):
    _name = 'mrp.warn.insufficient.qty.scrap'
    _inherit = 'stock.warn.insufficient.qty.scrap'
    _description = 'Warn Insufficient Scrap Quantity In Mrp'

    production_id = fields.Many2one('mrp.production', 'Manufacturing Order')
    workorder_id = fields.Many2one('mrp.workorder', 'Work Order')

    def action_done(self):
        values = {
            'production_id': self.production_id.id,
            'workorder_id': self.workorder_id.id,
        }
        scrap = self.env['stock.scrap'].create(values)
        return scrap.do_scrap()
