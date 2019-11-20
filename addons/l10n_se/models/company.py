# -*- coding: utf-8 -*-

from odoo import models, fields


class Company(models.Model):
    _inherit = 'res.company'

    l10n_se_country_code = fields.Char(string='Country code', related="country_id.code")
