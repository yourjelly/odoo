# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _name = 'res.company'
    _inherit = 'res.company'

    l10n_it_edi_doi_declaration_of_intent_tax = fields.Many2one(
        comodel_name='account.tax',
        compute='_compute_l10n_it_edi_doi_declaration_of_intent_tax',
        string="Declaration of Intent Tax",
    )

    l10n_it_edi_doi_declaration_of_intent_fiscal_position = fields.Many2one(
        comodel_name='account.fiscal.position',
        compute='_compute_l10n_it_edi_doi_declaration_of_intent_fiscal_position',
        string="Declaration of Intent Fiscal Position",
    )

    def _compute_l10n_it_edi_doi_declaration_of_intent_fiscal_position(self):
        it_companies = self.filtered(lambda company: company.chart_template == 'it')
        (self - it_companies).l10n_it_edi_doi_declaration_of_intent_fiscal_position = False
        for company in it_companies:
            fiscal_position = self.env['account.chart.template'].with_company(company)\
                .ref('declaration_of_intent_fiscal_position', raise_if_not_found=False)
            company.l10n_it_edi_doi_declaration_of_intent_fiscal_position = fiscal_position or False

    def _compute_l10n_it_edi_doi_declaration_of_intent_tax(self):
        it_companies = self.filtered(lambda company: company.chart_template == 'it')
        (self - it_companies).l10n_it_edi_doi_declaration_of_intent_tax = False
        for company in it_companies:
            tax = self.env['account.chart.template'].with_company(company)\
                .ref('00di', raise_if_not_found=False)
            company.l10n_it_edi_doi_declaration_of_intent_tax = tax or False
