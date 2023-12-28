# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"
    _rec_names_search = ["display_name", "email", "ref", "vat", "company_registry", "l10n_hu_group_vat"]

    l10n_hu_group_vat = fields.Char(
        string="HU VAT Group Number",
        size=13,
        copy=False,
        help="VAT Number of the VAT group this company belongs to.",
        index=True,
    )
    l10n_hu_company_tax_arrangments = fields.Selection(
        selection=[
            ("ie", "Individual Exemption"),
            ("ca", "Cash Accounting"),
            ("sb", "Small Business"),
        ],
        string="HU special tax arrangements",
    )

    @api.model
    def _commercial_fields(self):
        return super()._commercial_fields() + [
            "l10n_hu_group_vat",
            "l10n_hu_company_tax_arrangments",
        ]

    @api.model
    def _run_vies_test(self, vat_number, default_country):
        """Convert back the hungarian format to EU format: 12345678-1-12 => HU12345678"""
        if default_country and default_country.code == "HU" and not vat_number.startswith("HU"):
            vat_number = f"HU{vat_number[:8]}"
        return super()._run_vies_test(vat_number, default_country)
