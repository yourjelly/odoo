# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class InsufficientInventoryWizard(models.TransientModel):
    _name = 'insufficient.inventory.wizard'
    _order = 'id desc'

    @api.model
    def get_inv_data(self):
        rec = self.env[self._context.get('active_model')].browse(self._context.get('active_id'))
        text = '<b>Product Inventory: </b><br/><br/><table style=\"width:50%\"><tr><th>Location</th><th>Quantity</th>'
        all_quants = self.env['stock.quant']._gather(rec.product_id, rec.location_id)
        if all_quants:
            for each in all_quants:
                text += '<tr><td>' + each.location_id.name + '</td><td>' + str(each.quantity) + '</td>'
            text += '</table>'
            return text
        return 0

    location_id = fields.Char(string='Location', readonly=True)
    product_id = fields.Char(string='Product', readonly=True)
    wizard_line_ids = fields.Html(string='Qty Available at', readonly=True, default=get_inv_data)
    scrap_id = fields.Many2one('stock.scrap', string='Scrap')


    def action_validate(self):
        if self.scrap_id:
            self.scrap_id.do_scrap()
        return True
