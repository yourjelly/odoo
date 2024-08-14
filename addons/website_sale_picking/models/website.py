# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Website(models.Model):
    _inherit = 'website'

    available_onsite_dm_id = fields.One2many(
        'delivery.carrier',
        inverse_name='website_id',
        string='Default onsite delivery method',
        compute='_compute_onsite_dm',
    )

    def _compute_onsite_dm(self):
        delivery_carriers = self.env['delivery.carrier'].search([('delivery_type', '=', 'onsite')])
        for website in self:
            website.available_onsite_dm_id = delivery_carriers.filtered_domain([('website_id', '=', website.id)])
