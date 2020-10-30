# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountJournal(models.Model):
    _inherit = "account.journal"

    # Use for filter import and export type.
    l10n_in_gstin_partner_id = fields.Many2one('res.partner', string="GSTIN Unit", ondelete="restrict", help="GSTIN related to this journal. If empty then consider as company GSTIN.")

    def name_get(self):
        """
            Add GSTIN number in name as suffix so user can easily find the right journal.
            Used super to ensure nothing is missed.
        """
        result = super().name_get()
        result_dict = dict(result)
        indian_journals = self.filtered(lambda j: j.company_id.country_id.code == 'IN' and
            j.l10n_in_gstin_partner_id and j.l10n_in_gstin_partner_id.vat)
        for journal in indian_journals:
            name = result_dict[journal.id]
            name += "- %s" % (journal.l10n_in_gstin_partner_id.vat)
            result_dict[journal.id] = name
        return list(result_dict.items())


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    l10n_in_invoice_line_id = fields.Many2one('account.move.line', 'Invoice Line')
    l10n_in_matching_lines_ref = fields.Text('Matching Ref',
        help='Technical field to map invoice base line with its tax lines.'
    )

    @api.depends('move_id.line_ids', 'move_id.line_ids.tax_line_id', 'move_id.line_ids.debit', 'move_id.line_ids.credit')
    def _compute_tax_base_amount(self):
        aml = self.filtered(lambda l: l.company_id.country_id.code == 'IN' and l.tax_line_id  and l.product_id)
        for move_line in aml:
            base_lines = move_line.move_id.line_ids.filtered(lambda line: move_line.tax_line_id in line.tax_ids and move_line.product_id == line.product_id)
            move_line.tax_base_amount = abs(sum(base_lines.mapped('balance')))
        remaining_aml = self - aml
        if remaining_aml:
            return super(AccountMoveLine, remaining_aml)._compute_tax_base_amount()

    def _update_l10n_in_invoice_line_id(self):
        tax_base_lines_dict = {}
        Line = self.env['account.move.line']
        for line in self.filtered('l10n_in_matching_lines_ref'):
            if not tax_base_lines_dict.get(line.l10n_in_matching_lines_ref):
                tax_base_lines_dict[line.l10n_in_matching_lines_ref] = {
                    'tax_lines': Line,
                    'base_lines': Line
                }
            if line.tax_line_id:
                tax_base_lines_dict[line.l10n_in_matching_lines_ref]['tax_lines'] += line
            elif line.tax_ids:
                tax_base_lines_dict[line.l10n_in_matching_lines_ref]['base_lines'] += line
        for ref, lines in tax_base_lines_dict.items():
            if lines.get('tax_lines') and lines.get('base_lines'):
                lines['tax_lines'].write({
                    'l10n_in_invoice_line_id': lines['base_lines']
                })
        return True

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        lines._update_l10n_in_invoice_line_id()
        return lines

    def write(self, vals):
        res = super().write(vals)
        self._update_l10n_in_invoice_line_id()
        return res

class AccountTax(models.Model):
    _inherit = 'account.tax'

    l10n_in_reverse_charge = fields.Boolean("Reverse charge", help="Tick this if this tax is reverse charge. Only for Indian accounting")

    # TODO: check if this is required or not
    # def get_grouping_key(self, invoice_tax_val):
    #     """ Returns a string that will be used to group account.invoice.tax sharing the same properties"""
    #     key = super(AccountTax, self).get_grouping_key(invoice_tax_val)
    #     if self.company_id.country_id.code == 'IN':
    #         key += "-%s-%s"% (invoice_tax_val.get('l10n_in_product_id', False),
    #             invoice_tax_val.get('l10n_in_uom_id', False))
    #     return key
