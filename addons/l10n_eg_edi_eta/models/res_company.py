# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, api


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_eg_client_identifier = fields.Char('ETA Client ID')
    l10n_eg_client_secret_1 = fields.Char('ETA Secret 1')
