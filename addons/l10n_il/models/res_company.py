# -*- coding: utf-8 -*-

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_il_company_income_tax_id_number = fields.Char(string='IncomeTax ID', readonly=False)
    l10n_il_withh_tax_id_number = fields.Char(string='WHT ID', readonly=False)
    l10n_il_branches_existence = fields.Boolean(string='Branch Existence', default=False, help="If the company has branches or segments managed with different accounting systems, then it should be True")
    l10n_il_branch_code = fields.Char("Branch Code", help="Mandatory only if any branch exists with different accounting system other than current company.")
