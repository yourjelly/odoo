# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    l10n_in_hsn_code = fields.Char(string="HSN/SAC Code", help="Harmonized System Nomenclature/Services Accounting Code")
    l10n_in_hsn_description = fields.Char(string="HSN/SAC Description", help="HSN/SAC description is required if HSN/SAC code is not provided.")

    @api.onchange('l10n_in_hsn_code')
    def _onchange_l10n_in_hsn_code(self):
        for record in self:
            active_hsn_code_digit_len = self.env.companies.mapped('l10n_in_hsn_code_digit')
            # Remove False value if any company have False value in l10n_in_hsn_code_digit
            active_hsn_code_digit_len = list(filter(bool, active_hsn_code_digit_len))
            check_hsn = record.sale_ok and record.l10n_in_hsn_code and active_hsn_code_digit_len
            if check_hsn and len(record.l10n_in_hsn_code) < int(max(active_hsn_code_digit_len)):
                return {'warning': {'title': "Warning", 'message': _("As per your HSN/SAC code validation, minimum %s digits HSN/SAC code is required.", max(active_hsn_code_digit_len))}}
