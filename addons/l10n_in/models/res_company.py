# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    #for Multi GSTIN.
    l10n_in_multi_gstin_numbers = fields.Boolean("Multiple GSTIN registered",
        help="Use this if setup with more than one state and obtained multiple registrations.")
    l10n_in_gstin_partner_ids = fields.One2many('res.partner', 'l10n_in_gstin_company_id', string="GST")
