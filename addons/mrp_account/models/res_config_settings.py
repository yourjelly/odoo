# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_mrp_wip = fields.Boolean("Work In Progress", implied_group='mrp_account.group_mrp_wip')
