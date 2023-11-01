# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    plan_to_change_car = fields.Boolean('Plan To Change Car', default=False)
    plan_to_change_bike = fields.Boolean('Plan To Change Bike', default=False)

    @api.model
    def _fields_whitelist_write_on_internal_user(self):
        return ['plan_to_change_car', 'plan_to_change_bike']
