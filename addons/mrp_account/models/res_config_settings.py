# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_mrp_wip = fields.Boolean("Work In Progress", implied_group='mrp_account.group_mrp_wip')

    def set_values(self):
        super().set_values()
        self.env['res.company'].sudo().search([]).wip_location_id.write({'active': self.group_mrp_wip})
