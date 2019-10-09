# -*- coding: utf-8 -*-

from odoo import models, fields


class Partner(models.Model):
    _inherit = 'res.partner'

    l10n_se_corporate_identification = fields.Char(string='Corporate ID')
