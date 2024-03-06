# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class StockWarnInsufficientQtyUnbuild(models.TransientModel):
    _name = 'stock.warn.insufficient.qty.unbuild'
    _inherit = 'stock.warn.insufficient.qty'
    _description = 'Warn Insufficient Unbuild Quantity'

    unbuild_id = fields.Many2one('mrp.unbuild', 'Unbuild')

    def _get_reference_document_company_id(self):
        return self.unbuild_id.company_id

    def _get_reference_company_id(self):
        company = self.env['stock.scrap'].browse(self._context.get('default_unbuild_id')).company_id
        return company
    def action_done(self):
        self.ensure_one()
        return self.unbuild_id.action_unbuild()
