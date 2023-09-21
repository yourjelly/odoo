# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class ProductProduct(models.Model):
    _inherit = "product.product"

    standard_price_update_warning_message = fields.Char(compute="_compute_standard_price_update_warning_message", store=False)

    @api.depends('standard_price')
    def _compute_standard_price_update_warning_message(self):
        for product in self:
            if self.env['hr.expense'].search_count([('product_id', '=', product.id), ('state', 'in', ['draft', 'reported'])], limit=1):
                product.standard_price_update_warning_message = _("There are unposted expenses linked to this category. Updating the category cost will change some expenses' amounts. Make sure it is what you want to do.")
            else:
                product.standard_price_update_warning_message = ""