# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models

class LoyaltyProgram(models.Model):
    _inherit = 'loyalty.program'

    @api.model
    def _program_type_default_values(self):
        res = super()._program_type_default_values()
        # Add a loyalty reward for free shipping
        res['loyalty']['reward_ids'].append((0, 0, {
            'reward_type': 'shipping',
            'required_points': 100,
        }))
        return res
