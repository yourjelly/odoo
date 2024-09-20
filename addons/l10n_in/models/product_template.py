# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from odoo import api, models, fields, _


class ProductProduct(models.Model):
    _inherit = 'product.product'

    l10n_in_hsn_code_id = fields.Many2one(
        comodel_name='product.customs_code',
        domain="[('code_type', 'in', ['hs', 'l10n_in_hsn', 'l10n_in_sac'])]",
    )


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    l10n_in_hsn_code = fields.Char(string="HSN/SAC Code", help="Harmonized System Nomenclature/Services Accounting Code")
    l10n_in_hsn_warning = fields.Text(string="HSC/SAC warning", compute="_compute_l10n_in_hsn_warning")

    l10n_in_hsn_code_id = fields.Many2one(
        comodel_name='product.customs_code',
        compute='_compute_l10n_in_hsn_code_id',
        inverse='_set_l10n_in_hsn_id',
    )

    @api.depends('product_variant_ids.l10n_in_hsn_id')
    def _compute_l10n_in_hsn_code_id(self):
        self._compute_template_field_from_variant_field('l10n_in_hsn_id')

    def _set_l10n_in_hsn_id(self):
        self._set_product_variant_field('l10n_in_hsn_id')

    def _get_related_fields_variant_template(self):
        fields = super()._get_related_fields_variant_template()
        fields += ['l10n_in_hsn_id']
        return fields


    @api.depends('sale_ok', 'l10n_in_hsn_code')
    def _compute_l10n_in_hsn_warning(self):
        digit_suffixes = {
            '4': _("either 4, 6 or 8"),
            '6': _("either 6 or 8"),
            '8': _("8")
        }
        active_hsn_code_digit_len = max(
            int(company.l10n_in_hsn_code_digit)
            for company in self.env.companies
        )
        for record in self:
            check_hsn = record.sale_ok and record.l10n_in_hsn_code and active_hsn_code_digit_len
            if check_hsn and (not re.match(r'^\d{4}$|^\d{6}$|^\d{8}$', record.l10n_in_hsn_code) or len(record.l10n_in_hsn_code) < active_hsn_code_digit_len):
                record.l10n_in_hsn_warning = _(
                    "HSN code field must consist solely of digits and be %s in length.",
                    digit_suffixes.get(str(active_hsn_code_digit_len))
                )
                continue
            record.l10n_in_hsn_warning = False
