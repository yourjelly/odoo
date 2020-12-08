# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class CompanyVAT(models.Model):
    _name = "account.company.vat"
    _description = "Company VAT"

    company_id = fields.Many2one(string="Company", comodel_name='res.company', required=True)
    country_id = fields.Many2one(string="Country", comodel_name='res.country', required=True)
    vat_number = fields.Char(string="VAT", required=True) # TODO OCO y'avait pas qqch quelque part pour changer ça en TIN ou quoi ? A vérifier

