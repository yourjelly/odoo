# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    vat_check_vies = fields.Boolean(string='Verify VAT Numbers')
    #TODO OCO il va falloir modifier ceci (et ce module en général) au passage => one ne le renommerait pas, d'ailleurs ? => account_vat_check ?