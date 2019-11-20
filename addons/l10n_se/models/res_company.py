# -*- coding: utf-8 -*-

from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    country_code = fields.Char(string='Country code', related="country_id.code")
