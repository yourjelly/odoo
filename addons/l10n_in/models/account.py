# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountJournal(models.Model):
    _inherit = "account.journal"

    # Use for filter import and export type.
    l10n_in_import_export = fields.Boolean("Import/Export", help="Tick this if this journal is use for Import/Export Under Indian GST.")


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_in_gstin_partner_id = fields.Many2one(
        'res.partner',
        string="GSTIN",
        required=True,
        default=lambda self: self.env['res.company']._company_default_get('account.move').partner_id,
        domain="[('l10n_in_gstin_company_id', '=', company_id)]")
    l10n_in_place_of_supply = fields.Many2one(
        'res.country.state', string="Place Of Supply",
        states={'posted': [('readonly', True)]}, domain=[("country_id.code", "=", "IN")])


class AccountTax(models.Model):
    _inherit = 'account.tax'

    l10n_in_reverse_charge = fields.Boolean("Reverse charge", help="Tick this if this tax is reverse charge.")

    def get_grouping_key(self, invoice_tax_val):
        """ Returns a string that will be used to group account.invoice.tax sharing the same properties"""
        key = super(AccountTax, self).get_grouping_key(invoice_tax_val)
        if self.company_id.country_id.code == 'IN':
            key += "-%s-%s-%s-%s"% (invoice_tax_val.get('l10n_in_product_id', False),
                invoice_tax_val.get('l10n_in_uom_id', False),
                invoice_tax_val.get('l10n_in_is_eligible_for_itc', False),
                invoice_tax_val.get('l10n_in_itc_percentage', False))
        return key


class AccountAccountTag(models.Model):
    _inherit = 'account.account.tag'

    l10n_in_use_in_report = fields.Boolean(string="Use in Report", help="Use in Indian GSTR report")
