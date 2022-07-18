# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_ke_url = fields.Char('URL', default="http://localhost:8069") # Could be replaced by IoT Box url or something in enterprise

