# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    l10n_in_country_code = fields.Char(string="Country code", related='country_id.code')
