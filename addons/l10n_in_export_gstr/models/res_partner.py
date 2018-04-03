# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    country_code = fields.Char(related="country_id.code",string="Country code")
    composition = fields.Boolean(string="Is Composition", help="Check this box if this vendor is under composition scheme")
