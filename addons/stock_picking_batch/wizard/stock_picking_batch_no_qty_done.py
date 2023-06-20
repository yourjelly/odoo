# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockPickingBatchNoQtyDone(models.TransientModel):
    _name = 'stock.picking.batch.no.qty.done'
    _description = 'If any picking line has 0 qty done then this wizard will warn before removing the picking line'

    picking_batch_id = fields.Many2one(comodel_name="stock.picking.batch")

    def confirm_batch(self):
        pickings = self.env['stock.picking'].browse(self.env.context.get('pickings'))
        context = self.env.context.get('context')
        return pickings.with_context(skip_immediate=True, **context).button_validate()
