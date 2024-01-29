# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class ResCompany(models.Model):
    _inherit = 'res.company'

    @api.model_create_multi
    def create(self, vals_list):
        result = super().create(vals_list)
        self.env['resource.calendar.leaves'].sudo().generate_public_leaves()
        return result
