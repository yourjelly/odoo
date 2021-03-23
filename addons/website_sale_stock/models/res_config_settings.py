# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    allow_to_order = fields.Selection([
        ('available', 'Allow the user to order only if there is enough quantity on hand for the product'),
        ('always', 'Allow the user to order even if there is no quantity on hand for the product'),
    ], string='Allow to order', default='always')
    available_threshold = fields.Float(string='Availability Threshold', default=5.0)

    show_availability = fields.Selection([
        ('always', 'Always'),
        ('threshold', 'Below Threshold'),
        ('never', 'Never'),
    ], string='Show availability', default='always')
    available_message = fields.Html(related='website_id.available_message', readonly=False)
    out_of_stock_message = fields.Html(related='website_id.out_of_stock_message', readonly=False)
    threshold_message = fields.Html(related='website_id.threshold_message', readonly=False)

    website_warehouse_id = fields.Many2one('stock.warehouse', related='website_id.warehouse_id', domain="[('company_id', '=', website_company_id)]", readonly=False)

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        IrDefault = self.env['ir.default'].sudo()

        IrDefault.set('product.template', 'allow_to_order', self.allow_to_order)
        IrDefault.set('product.template', 'available_threshold', self.available_threshold)
        IrDefault.set('product.template', 'show_availability', self.show_availability)

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        IrDefault = self.env['ir.default'].sudo()

        res.update(allow_to_order=IrDefault.get('product.template', 'allow_to_order') or 'always',
                   available_threshold=IrDefault.get('product.template', 'available_threshold') or 5.0,
                   show_availability=IrDefault.get('product.template', 'show_availability') or 'always')

        return res

    @api.onchange('website_company_id')
    def _onchange_website_company_id(self):
        if self.website_warehouse_id.company_id != self.website_company_id:
            return {'value': {'website_warehouse_id': False}}
