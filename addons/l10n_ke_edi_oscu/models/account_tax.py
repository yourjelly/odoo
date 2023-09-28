# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountTax(models.Model):
    _inherit = 'account.tax'

    l10n_ke_tax_type = fields.Many2one(
        'l10n_ke_edi_oscu.code',
        string='KRA Tax Code',
        domain=[('code_type', '=', '04')],
        compute='_compute_l10n_ke_tax_type',
        store=True, readonly=False,
        help='KRA code that describes a tax rate or exemption.',
    )

    @api.depends('amount')
    def _compute_l10n_ke_tax_type(self):
        codes = self.env['l10n_ke_edi_oscu.code'].search([
            ('code_type', '=', '04')
        ])
        rate_to_code_map = {code.tax_rate: code for code in codes}
        for tax in self:
            tax.l10n_ke_tax_type = rate_to_code_map.get(tax.amount)

    # l10n_ke_tax_type_id = fields.Many2one(
    #     'l10n_ke_edi_oscu.code',
    #     compute='_compute_l10n_ke_tax_type_id',
    #     string='KRA Tax Code',
    #     store=True, readonly=False,
    #     domain=[('classification_code', '=', '04'), ('use', '=', True)],
    #     help='KRA code that describes a tax rate or exemption.',
    # )

    # @api.depends('amount')
    # def _compute_l10n_ke_tax_type_id(self):
    #     for tax in self:
    #         tax.l10n_ke_tax_type_id = self.env['l10n_ke_edi_oscu.code'].search([
    #             ('classification_code', '=', '04'),
    #             ('use', '=', True),
    #             ('code', '=', {16: 'B', 8: 'E', 0: 'C'}.get(tax.amount)),
    #         ], limit=1)
