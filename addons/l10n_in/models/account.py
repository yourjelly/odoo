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


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    l10n_in_cess_line_ids = fields.Many2many('account.move.line', 'account_move_line_l10n_in_cess_rel', 'account_move_line_id', 'account_move_line_cess_id',
        string="Cess Line", compute="_compute_cess_line", store=True)
    l10n_in_is_eligible_for_itc = fields.Boolean(string="Is eligible for ITC", help="Check this box if this product is eligible for ITC(Input Tax Credit) under GST")
    l10n_in_itc_percentage = fields.Float(string="ITC percentage", help="Enter percentage in case of partly eligible for ITC(Input Tax Credit) under GST.")

    @api.constrains('l10n_in_itc_percentage')
    def _check_l10n_in_itc_percentage(self):
        for record in self:
            if record.l10n_in_itc_percentage < 0 or record.l10n_in_itc_percentage > 100:
                ValidationError(_("ITC percentage between 0 to 100"))

    @api.depends('tax_line_id.tax_group_id')
    def _compute_cess_line(self):
        group_cess = self.env.ref('l10n_in.cess_group')
        for line in self.filtered(lambda l: l.tax_line_id and l.tax_line_id.tax_group_id != group_cess):
            is_cess_domain = [
                ('move_id', '=', line.move_id.id),
                ('product_id','=', line.product_id.id),
                ('tax_ids.tax_group_id', '=', group_cess.id),
                '|', ('tax_ids', '=', line.tax_line_id.id), ('tax_ids.children_tax_ids', '=', line.tax_line_id.id)]
            if self.search(is_cess_domain, limit=1):
                line.l10n_in_cess_line_ids = line.move_id.line_ids.filtered(lambda l: l.product_id == line.product_id and l.tax_line_id.tax_group_id == group_cess)


class AccountTax(models.Model):
    _inherit = 'account.tax'

    l10n_in_product_wise_line = fields.Boolean('Product Wise Line')

    def get_grouping_key(self, invoice_tax_val):
        """ Returns a string that will be used to group account.invoice.tax sharing the same properties"""
        key = super(AccountTax, self).get_grouping_key(invoice_tax_val)
        if self.browse(invoice_tax_val['tax_id']).l10n_in_product_wise_line:
            key += "-%s-%s-%s-%s"% (invoice_tax_val.get('l10n_in_product_id', False),
                invoice_tax_val.get('l10n_in_uom_id', False),
                invoice_tax_val.get('l10n_in_is_eligible_for_itc', False),
                invoice_tax_val.get('l10n_in_itc_percentage', False))
        return key


class AccountAccountTag(models.Model):
    _inherit = 'account.account.tag'

    l10n_in_use_in_report = fields.Boolean(string="Use in Report", help="Use in Indian GSTR report")
